const test = require('tape')
const uuid = require('uuid')
const Tonic = require('..')

const sleep = t => new Promise(resolve => setTimeout(resolve, t))

test('sanity', t => {
  t.ok(true)

  const version = Tonic.version
  const parts = version.split('.')
  t.ok(parseInt(parts[0]) >= 10)

  t.end()
})

test('attach to dom', t => {
  class ComponentA extends Tonic {
    render () {
      return '<div></div>'
    }
  }

  document.body.innerHTML = `
    <component-a></component-a>
  `

  Tonic.add(ComponentA)

  const div = document.querySelector('div')
  t.ok(div, 'a div was created and attached')
  t.end()
})

test('Tonic escapes text', t => {
  class Comp extends Tonic {
    render () {
      const userInput = this.props.userInput
      return this.html`<div>${userInput}</div>`
    }
  }
  const compName = `x-${uuid()}`
  Tonic.add(Comp, compName)

  const userInput = '<pre>lol</pre>'
  document.body.innerHTML = `
    <${compName} user-input="${userInput}"></${compName}>
  `

  const divs = document.querySelectorAll('div')
  t.equal(divs.length, 1)
  const div = divs[0]
  t.equal(div.childNodes.length, 1)
  t.equal(div.childNodes[0].nodeType, 3)
  t.equal(div.innerHTML, '&lt;pre&gt;lol&lt;/pre&gt;')
  t.equal(div.childNodes[0].data, '<pre>lol</pre>')

  t.end()
})

test('Tonic escapes attribute injection', t => {
  class Comp1 extends Tonic {
    render () {
      const userInput2 = '" onload="console.log(42)'
      const userInput = '"><script>console.log(42)</script>'
      const userInput3 = 'a" onmouseover="alert(1)"'

      const input = this.props.input === 'script'
        ? userInput : this.props.input === 'space'
          ? userInput3 : userInput2

      if (this.props.spread) {
        return this.html`
          <div ... ${{ attr: input }}></div>
        `
      }

      if (this.props.quoted) {
        return this.html`
          <div attr="${input}"></div>
        `
      }

      return this.html`
        <div attr=${input}></div>
      `
    }
  }
  const compName = `x-${uuid()}`
  Tonic.add(Comp1, compName)

  document.body.innerHTML = `
    <${compName} input="space" quoted="1"></${compName}>
    <${compName} input="space" spread="1"></${compName}>
    <!-- This is XSS attack below. -->
    <${compName} input="space"></${compName}>
    <${compName} input="script" quoted="1"></${compName}>
    <${compName} input="script" spread="1"></${compName}>
    <${compName} input="script"></${compName}>
    <${compName} quoted="1"></${compName}>
    <${compName} spread="1"></${compName}>
    <!-- This is XSS attack below. -->
    <${compName}></${compName}>
  `

  const divs = document.querySelectorAll('div')
  t.equal(divs.length, 9)
  for (let i = 0; i < divs.length; i++) {
    const div = divs[i]
    t.equal(div.childNodes.length, 0)
    t.equal(div.hasAttribute('onmouseover'), i === 2)
    t.equal(div.hasAttribute('onload'), i === 8)
  }

  t.end()
})

test('attach to dom with shadow', t => {
  Tonic.add(class ShadowComponent extends Tonic {
    constructor (o) {
      super(o)
      this.attachShadow({ mode: 'open' })
    }

    render () {
      return this.html`
        <div ...${{ num: 1, str: 'X' }}>
          <component-a></component-a>
        </div>
      `
    }
  })

  document.body.innerHTML = `
    <shadow-component></shadow-component>
  `

  const c = document.querySelector('shadow-component')
  const el = document.querySelector('div')
  t.ok(!el, 'no div found in document')
  const div = c.shadowRoot.querySelector('div')
  t.ok(div, 'a div was created and attached to the shadow root')
  t.ok(div.hasAttribute('num'), 'attributes added correctly')
  t.ok(div.hasAttribute('str'), 'attributes added correctly')
  t.end()
})

test('pass props', t => {
  Tonic.add(class ComponentBB extends Tonic {
    render () {
      return this.html`<div>${this.props.data[0].foo}</div>`
    }
  })

  Tonic.add(class ComponentB extends Tonic {
    connected () {
      this.setAttribute('id', this.props.id)
      t.equal(this.props.disabled, '', 'disabled property was found')
      t.equal(this.props.empty, '', 'empty property was found')
      t.ok(this.props.testItem, 'automatically camelcase props')
    }

    render () {
      const test = [
        { foo: 'hello, world' }
      ]

      return this.html`
        <component-b-b
          id="y"
          data=${test}
          number=${42.42}
          fn=${() => 'hello, world'}>
        </component-b-b>
      `
    }
  })

  document.body.innerHTML = `
    <component-b
      id="x"
      test-item="true"
      disabled
      empty=''>
    </component-b>
  `

  const bb = document.getElementById('y')
  {
    const props = bb.getProps()
    t.equal(props.fn(), 'hello, world', 'passed a function')
    t.equal(props.number, 42.42, 'float parsed properly')
  }

  const div1 = document.getElementsByTagName('div')[0]
  t.equal(div1.textContent, 'hello, world', 'data prop received properly')

  const div2 = document.getElementById('x')
  t.ok(div2)

  const props = div2.getProps()
  t.equal(props.testItem, 'true', 'correct props')

  t.end()
})

test('get element by id and set properties via the api', t => {
  document.body.innerHTML = `
    <component-c number=1></component-c>
  `

  class ComponentC extends Tonic {
    willConnect () {
      this.setAttribute('id', 'test')
    }

    render () {
      return `<div>${this.props.number}</div>`
    }
  }

  Tonic.add(ComponentC)

  {
    const div = document.getElementById('test')
    t.ok(div, 'a component was found by its id')
    t.equal(div.textContent, '1', 'initial value is set by props')
    t.ok(div.reRender, 'a component has the reRender method')
  }

  const div = document.getElementById('test')
  div.reRender({ number: 2 })

  window.requestAnimationFrame(() => {
    t.equal(div.textContent, '2', 'the value was changed by reRender')
    t.end()
  })
})

test('inheritance and super.render()', t => {
  class Stuff extends Tonic {
    render () {
      return '<div>nice stuff</div>'
    }
  }

  class SpecificStuff extends Stuff {
    render () {
      return this.html`
        <div>
          <header>A header</header>
          ${Tonic.raw(super.render())}
        </div>
      `
    }
  }

  const compName = `x-${uuid()}`
  Tonic.add(SpecificStuff, compName)

  document.body.innerHTML = `
    <${compName}></${compName}>
  `

  const divs = document.querySelectorAll('div')
  t.equal(divs.length, 2)

  const first = divs[0]
  t.equal(first.childNodes.length, 5)
  t.equal(first.childNodes[1].tagName, 'HEADER')
  t.equal(first.childNodes[3].tagName, 'DIV')
  t.equal(first.childNodes[3].textContent, 'nice stuff')

  t.end()
})

test('Tonic#html returns raw string', t => {
  class Stuff extends Tonic {
    render () {
      return this.html`<div>nice stuff</div>`
    }
  }

  class SpecificStuff extends Stuff {
    render () {
      return this.html`
        <div>
          <header>A header</header>
          ${super.render()}
        </div>
      `
    }
  }

  const compName = `x-${uuid()}`
  Tonic.add(SpecificStuff, compName)

  document.body.innerHTML = `
    <${compName}></${compName}>
  `

  const divs = document.querySelectorAll('div')
  t.equal(divs.length, 2)

  const first = divs[0]
  t.equal(first.childNodes.length, 5)
  t.equal(first.childNodes[1].tagName, 'HEADER')
  t.equal(first.childNodes[3].tagName, 'DIV')
  t.equal(first.childNodes[3].textContent, 'nice stuff')

  t.end()
})

test('construct from api', t => {
  document.body.innerHTML = ''

  class ComponentD extends Tonic {
    render () {
      return `<div number="${this.props.number}"></div>`
    }
  }

  Tonic.add(ComponentD)
  const d = new ComponentD()
  document.body.appendChild(d)

  d.reRender({ number: 3 })

  window.requestAnimationFrame(() => {
    const div1 = document.body.querySelector('div')
    t.equal(div1.getAttribute('number'), '3', 'attribute was set in component')

    d.reRender({ number: 6 })

    window.requestAnimationFrame(() => {
      const div2 = document.body.querySelector('div')
      t.equal(div2.getAttribute('number'), '6', 'attribute was set in component')
      t.end()
    })
  })
})

test('stylesheets and inline styles', t => {
  document.body.innerHTML = `
    <component-f number=1></component-f>
  `

  class ComponentF extends Tonic {
    stylesheet () {
      return 'component-f div { color: red; }'
    }

    styles () {
      return {
        foo: {
          color: 'red'
        },
        bar: {
          backgroundColor: 'red'
        }
      }
    }

    render () {
      return '<div styles="foo bar"></div>'
    }
  }

  Tonic.add(ComponentF)

  const expected = 'component-f div { color: red; }'
  const style = document.querySelector('component-f style')
  t.equal(style.textContent, expected, 'style was prefixed')
  const div = document.querySelector('component-f div')
  const computed = window.getComputedStyle(div)
  t.equal(computed.color, 'rgb(255, 0, 0)', 'inline style was set')
  t.equal(computed.backgroundColor, 'rgb(255, 0, 0)', 'inline style was set')

  t.end()
})

test('static stylesheet', t => {
  document.body.innerHTML = `
    <component-static-styles>
    </component-static-styles>
  `

  class ComponentStaticStyles extends Tonic {
    static stylesheet () {
      return 'component-static-styles div { color: red; }'
    }

    render () {
      return '<div>RED</div>'
    }
  }

  Tonic.add(ComponentStaticStyles)

  const style = document.head.querySelector('style')
  t.ok(style, 'has a style tag')
  const div = document.querySelector('component-static-styles div')
  const computed = window.getComputedStyle(div)
  t.equal(computed.color, 'rgb(255, 0, 0)', 'inline style was set')
  t.end()
})

test('component composition', t => {
  document.body.innerHTML = `
    A Few
    <x-bar></x-bar>
    Noisy
    <x-bar></x-bar>
    Text Nodes
  `

  class XFoo extends Tonic {
    render () {
      return '<div class="foo"></div>'
    }
  }

  class XBar extends Tonic {
    render () {
      return `
        <div class="bar">
          <x-foo></x-foo>
          <x-foo></x-foo>
        </div>
      `
    }
  }

  Tonic.add(XFoo)
  Tonic.add(XBar)

  t.equal(document.body.querySelectorAll('.bar').length, 2, 'two bar divs')
  t.equal(document.body.querySelectorAll('.foo').length, 4, 'four foo divs')
  t.end()
})

test('lifecycle events', t => {
  document.body.innerHTML = '<x-quxx></x-quxx>'

  class XBazz extends Tonic {
    constructor (p) {
      super(p)
      t.ok(true, 'calling bazz ctor')
    }

    disconnected () {
      t.ok(true, 'disconnected event fired')
    }

    render () {
      return '<div class="bar"></div>'
    }
  }

  class XQuxx extends Tonic {
    constructor (p) {
      super(p)
      t.ok(true, 'calling quxx ctor')
    }

    willConnect () {
      t.ok(true, 'willConnect event fired')
      const expectedRE = /<x-quxx><\/x-quxx>/
      t.ok(expectedRE.test(document.body.innerHTML), 'nothing added yet')
    }

    connected () {
      t.ok(true, 'connected event fired')
      const expectedRE = /<x-quxx><div class="quxx"><x-bazz><div class="bar"><\/div><\/x-bazz><\/div><\/x-quxx>/
      t.ok(expectedRE.test(document.body.innerHTML), 'rendered')
    }

    render () {
      t.ok(true, 'render event fired')
      return '<div class="quxx"><x-bazz></x-bazz></div>'
    }
  }

  Tonic.add(XBazz)
  Tonic.add(XQuxx)
  const q = document.querySelector('x-quxx')
  q.reRender({})
  const refsLength = Tonic._refIds.length

  // once again to overwrite the old instances
  q.reRender({})
  t.equal(Tonic._refIds.length, refsLength, 'Cleanup, refs correct count')

  // once again to check that the refs length is the same
  q.reRender({})
  t.equal(Tonic._refIds.length, refsLength, 'Cleanup, refs still correct count')
  t.end()
})

test('compose sugar (this.children)', t => {
  class ComponentG extends Tonic {
    render () {
      return this.html`<div class="parent">${this.children}</div>`
    }
  }

  class ComponentH extends Tonic {
    render () {
      return `<div class="child">${this.props.value}</div>`
    }
  }

  document.body.innerHTML = `
    <component-g>
      <component-h value="x"></component-h>
    </component-g>
  `

  Tonic.add(ComponentG)
  Tonic.add(ComponentH)

  const g = document.querySelector('component-g')
  const children = g.querySelectorAll('.child')
  t.equal(children.length, 1, 'child element was added')
  t.equal(children[0].innerHTML, 'x')

  const h = document.querySelector('component-h')

  h.reRender({
    value: 'y'
  })

  window.requestAnimationFrame(() => {
    const childrenAfterSetProps = g.querySelectorAll('.child')
    t.equal(childrenAfterSetProps.length, 1, 'child element was replaced')
    t.equal(childrenAfterSetProps[0].innerHTML, 'y')
    t.end()
  })
})

test('ensure registration order does not affect rendering', t => {
  class ComposeA extends Tonic {
    render () {
      return this.html`
        <div class="a">
          ${this.children}
        </div>
      `
    }
  }

  class ComposeB extends Tonic {
    render () {
      return this.html`
        <select>
          ${this.childNodes}
        </select>
      `
    }
  }

  document.body.innerHTML = `
    <compose-a>
      <compose-b>
        <option value="a">1</option>
        <option value="b">2</option>
        <option value="c">3</option>
      </compose-b>
    </compose-a>
  `

  Tonic.add(ComposeB)
  Tonic.add(ComposeA)

  const select = document.querySelectorAll('.a select')
  t.equal(select.length, 1, 'there is only one select')
  t.equal(select[0].children.length, 3, 'there are 3 options')

  t.end()
})

test('check that composed elements use (and re-use) their initial innerHTML correctly', t => {
  class ComponentI extends Tonic {
    render () {
      return this.html`<div class="i">
        <component-j>
          <component-k value="${this.props.value}">
          </component-k>
        </component-j>
      </div>`
    }
  }

  class ComponentJ extends Tonic {
    render () {
      return this.html`<div class="j">${this.children}</div>`
    }
  }

  class ComponentK extends Tonic {
    render () {
      return `<div class="k">${this.props.value}</div>`
    }
  }

  document.body.innerHTML = `
    <component-i value="x">
    </component-i>
  `

  Tonic.add(ComponentJ)
  Tonic.add(ComponentK)
  Tonic.add(ComponentI)

  t.comment('Uses init() instead of <app>')

  const i = document.querySelector('component-i')
  const kTags = i.getElementsByTagName('component-k')
  t.equal(kTags.length, 1)

  const kClasses = i.querySelectorAll('.k')
  t.equal(kClasses.length, 1)

  const kText = kClasses[0].textContent
  t.equal(kText, 'x', 'The text of the inner-most child was rendered correctly')

  i.reRender({
    value: 1
  })

  window.requestAnimationFrame(() => {
    const kTagsAfterSetProps = i.getElementsByTagName('component-k')
    t.equal(kTagsAfterSetProps.length, 1, 'correct number of components rendered')

    const kClassesAfterSetProps = i.querySelectorAll('.k')
    t.equal(kClassesAfterSetProps.length, 1, 'correct number of elements rendered')
    const kTextAfterSetProps = kClassesAfterSetProps[0].textContent
    t.equal(kTextAfterSetProps, '1', 'The text of the inner-most child was rendered correctly')
    t.end()
  })
})

test('mixed order declaration', t => {
  class AppXx extends Tonic {
    render () {
      return this.html`<div class="app">${this.children}</div>`
    }
  }

  class ComponentAx extends Tonic {
    render () {
      return '<div class="a">A</div>'
    }
  }

  class ComponentBx extends Tonic {
    render () {
      return this.html`<div class="b">${this.children}</div>`
    }
  }

  class ComponentCx extends Tonic {
    render () {
      return this.html`<div class="c">${this.children}</div>`
    }
  }

  class ComponentDx extends Tonic {
    render () {
      return '<div class="d">D</div>'
    }
  }

  document.body.innerHTML = `
    <app-xx>
      <component-ax>
      </component-ax>

      <component-bx>
        <component-cx>
          <component-dx>
          </component-dx>
        </component-cx>
      </component-bx>
    </app-xx>
  `

  Tonic.add(ComponentDx)
  Tonic.add(ComponentAx)
  Tonic.add(ComponentCx)
  Tonic.add(AppXx)
  Tonic.add(ComponentBx)

  {
    const div = document.querySelector('.app')
    t.ok(div, 'a div was created and attached')
  }

  {
    const div = document.querySelector('body .app .a')
    t.ok(div, 'a div was created and attached')
  }

  {
    const div = document.querySelector('body .app .b')
    t.ok(div, 'a div was created and attached')
  }

  {
    const div = document.querySelector('body .app .b .c')
    t.ok(div, 'a div was created and attached')
  }

  {
    const div = document.querySelector('body .app .b .c .d')
    t.ok(div, 'a div was created and attached')
  }

  t.end()
})

test('spread props', t => {
  class SpreadComponent extends Tonic {
    render () {
      return this.html`
        <div ...${this.props}></div>
      `
    }
  }

  class AppContainer extends Tonic {
    render () {
      const o = {
        a: 'testing',
        b: 2.2,
        FooBar: '"ok"'
      }

      const el = document.querySelector('#el').attributes

      return this.html`
        <spread-component ...${o}>
        </spread-component>

        <div ...${o}>
        </div>

        <span ...${el}></span>
      `
    }
  }

  document.body.innerHTML = `
    <app-container></app-container>
    <div id="el" d="1" e="3.3" f="xxx"></div>
  `

  Tonic.add(AppContainer)
  Tonic.add(SpreadComponent)

  const component = document.querySelector('spread-component')
  t.equal(component.getAttribute('a'), 'testing')
  t.equal(component.getAttribute('b'), '2.2')
  t.equal(component.getAttribute('foo-bar'), '"ok"')
  const div = document.querySelector('div:first-of-type')
  const span = document.querySelector('span:first-of-type')
  t.equal(div.attributes.length, 3, 'div also got expanded attributes')
  t.equal(span.attributes.length, 4, 'span got all attributes from div#el')
  t.end()
})

test('async render', async t => {
  class AsyncRender extends Tonic {
    async getSomeData () {
      await sleep(100)
      return 'Some Data'
    }

    async render () {
      const value = await this.getSomeData()
      return this.html`
        <p>${value}</p>
      `
    }
  }

  Tonic.add(AsyncRender)

  document.body.innerHTML = `
    <async-render></async-render>
  `

  let ar = document.body.querySelector('async-render')
  t.equal(ar.innerHTML, '')

  await sleep(200)

  ar = document.body.querySelector('async-render')
  t.equal(ar.innerHTML.trim(), '<p>Some Data</p>')
  t.end()
})

test('async generator render', async t => {
  class AsyncGeneratorRender extends Tonic {
    async * render () {
      yield 'X'

      await sleep(100)

      return 'Y'
    }
  }

  Tonic.add(AsyncGeneratorRender)

  document.body.innerHTML = `
    <async-generator-render>
    </async-generator-render>
  `

  await sleep(10)

  let ar = document.body.querySelector('async-generator-render')
  t.equal(ar.innerHTML, 'X')

  await sleep(200)

  ar = document.body.querySelector('async-generator-render')
  t.equal(ar.innerHTML, 'Y')
  t.end()
})

test('pass in references to children', t => {
  const cName = `x-${uuid()}`
  const dName = `x-${uuid()}`

  class DividerComponent extends Tonic {
    willConnect () {
      this.left = this.querySelector('.left')
      this.right = this.querySelector('.right')
    }

    render () {
      return this.html`
        ${this.left}<br/>
        ${this.right}
      `
    }
  }
  Tonic.add(DividerComponent, cName)

  class TextComp extends Tonic {
    render () {
      return this.html`<span>${this.props.text}</span>`
    }
  }
  Tonic.add(TextComp, dName)

  document.body.innerHTML = `
    <${cName}>
      <div class="left"><span>left</span></div>
      <${dName} class="right" text="right"></${dName}>
    </${cName}>
  `

  const pElem = document.querySelector(cName)

  const first = pElem.children[0]
  t.ok(first)
  t.equal(first.tagName, 'DIV')
  t.equal(first.className, 'left')
  t.equal(first.innerHTML, '<span>left</span>')

  const second = pElem.children[1]
  t.ok(second)
  t.equal(second.tagName, 'BR')

  const third = pElem.children[2]
  t.ok(third)
  t.equal(third.tagName, dName.toUpperCase())
  t.equal(third.className, 'right')
  t.equal(third.innerHTML, '<span>right</span>')

  t.end()
})

test('pass comp as ref in props', t => {
  const pName = `x-${uuid()}`
  const cName = `x-${uuid()}`

  class ParentComponent extends Tonic {
    constructor (o) {
      super(o)

      this.name = 'hello'
    }

    render () {
      return this.html`
        <div>
          <${cName} ref=${this}></${cName}>
        </div>
      `
    }
  }

  class ChildComponent extends Tonic {
    render () {
      return this.html`
        <div>${this.props.ref.name}</div>
      `
    }
  }

  Tonic.add(ParentComponent, pName)
  Tonic.add(ChildComponent, cName)

  document.body.innerHTML = `<${pName}></${pName}`

  const pElem = document.querySelector(pName)
  t.ok(pElem)

  const cElem = pElem.querySelector(cName)
  t.ok(cElem)

  t.equal(cElem.innerHTML.trim(), '<div>hello</div>')

  t.end()
})

test('default props', t => {
  class InstanceProps extends Tonic {
    constructor () {
      super()
      this.props = { num: 100 }
    }

    render () {
      return `<div>${JSON.stringify(this.props)}</div>`
    }
  }

  Tonic.add(InstanceProps)

  document.body.innerHTML = `
    <instance-props str="0x">
    </instance-props>
  `

  const actual = document.body.innerHTML.trim()

  const expectedRE = /<instance-props str="0x"><div>{"num":100,"str":"0x"}<\/div><\/instance-props>/

  t.ok(expectedRE.test(actual), 'elements match')
  t.end()
})

test('Tonic comp with null prop', t => {
  class InnerComp extends Tonic {
    render () {
      return this.html`<div>${String(this.props.foo)}</div>`
    }
  }
  const innerName = `x-${uuid()}`
  Tonic.add(InnerComp, innerName)

  class OuterComp extends Tonic {
    render () {
      return this.html`<${innerName} foo=${null}></${innerName}>`
    }
  }
  const outerName = `x-${uuid()}`
  Tonic.add(OuterComp, outerName)

  document.body.innerHTML = `<${outerName}></${outerName}>`

  const div = document.body.querySelector('div')
  t.ok(div)

  t.equal(div.textContent, 'null')
  t.end()
})

test('re-render nested component', t => {
  const pName = `x-${uuid()}`
  const cName = `x-${uuid()}`
  class ParentComponent extends Tonic {
    render () {
      const message = this.props.message
      return this.html`
        <div>
          <${cName} id="persist" message="${message}"></${cName}>
        </div>
      `
    }
  }

  class ChildStateComponent extends Tonic {
    updateText (newText) {
      this.state.text = newText
      this.reRender()
    }

    render () {
      const message = this.props.message
      const text = this.state.text || ''

      return this.html`
        <div>
          <label>${message}</label>
          <input type="text" value="${text}" />
        </div>
      `
    }
  }

  Tonic.add(ParentComponent, pName)
  Tonic.add(ChildStateComponent, cName)

  document.body.innerHTML = `
    <${pName} message="initial"></${pName}>
  `

  const pElem = document.querySelector(pName)
  t.ok(pElem)

  const label = pElem.querySelector('label')
  t.equal(label.textContent, 'initial')

  const input = pElem.querySelector('input')
  t.equal(input.value, '')

  const cElem = pElem.querySelector(cName)
  cElem.updateText('new text')

  window.requestAnimationFrame(onUpdate)

  function onUpdate () {
    const label = pElem.querySelector('label')
    t.equal(label.textContent, 'initial')

    const input = pElem.querySelector('input')
    t.equal(input.value, 'new text')

    pElem.reRender({
      message: 'new message'
    })

    window.requestAnimationFrame(onReRender)
  }

  function onReRender () {
    const label = pElem.querySelector('label')
    t.equal(label.textContent, 'new message')

    const input = pElem.querySelector('input')
    t.equal(input.value, 'new text')

    t.end()
  }
})

test('cleanup, ensure exist', t => {
  t.end()
  document.body.classList.add('finished')
})
