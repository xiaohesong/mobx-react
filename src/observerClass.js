import { PureComponent, Component } from "react"
import { createAtom, _allowStateChanges, Reaction, $mobx } from "mobx"
import { isUsingStaticRendering } from "mobx-react-lite"

import { newSymbol, shallowEqual, setHiddenProp, patch } from "./utils/utils"

const mobxAdminProperty = $mobx || "$mobx"
const mobxIsUnmounted = newSymbol("isUnmounted")
const skipRenderKey = newSymbol("skipRender")
const isForcingUpdateKey = newSymbol("isForcingUpdate")

export function makeClassComponentObserver(componentClass) {
    const target = componentClass.prototype
    if (target.componentWillReact)
        throw new Error("The componentWillReact life-cycle event is no longer supported")
    // 如果不是pureComponent，也不存在scu，那就给他赋值一个scu算法
    // 如果scu存在并且不是我们赋值的这个，那就给他报错。。。
    if (componentClass.__proto__ !== PureComponent) {
        if (!target.shouldComponentUpdate) target.shouldComponentUpdate = observerSCU
        else if (target.shouldComponentUpdate !== observerSCU)
            // n.b. unequal check, instead of existence check, as @observer might be on superclass as well
            throw new Error(
                "It is not allowed to use shouldComponentUpdate in observer based components."
            )
    }

    // this.props and this.state are made observable, just to make sure @computed fields that
    // are defined inside the component, and which rely on state or props, re-compute if state or props change
    // (otherwise the computed wouldn't update and become stale on props change, since props are not observable)
    // However, this solution is not without it's own problems: https://github.com/mobxjs/mobx-react/issues?utf8=%E2%9C%93&q=is%3Aissue+label%3Aobservable-props-or-not+
    makeObservableProp(target, "props")
    makeObservableProp(target, "state")

    const baseRender = target.render
    target.render = function() {
        return makeComponentReactive.call(this, baseRender)
    }
    patch(target, "componentWillUnmount", function() {
        if (isUsingStaticRendering() === true) return
        this.render[mobxAdminProperty] && this.render[mobxAdminProperty].dispose()
        this[mobxIsUnmounted] = true
    })
    return componentClass
}

function makeComponentReactive(render) {
    if (isUsingStaticRendering() === true) return render.call(this)

    /**
     * If props are shallowly modified, react will render anyway,
     * so atom.reportChanged() should not result in yet another re-render
     */
    setHiddenProp(this, skipRenderKey, false)
    /**
     * forceUpdate will re-assign this.props. We don't want that to cause a loop,
     * so detect these changes
     */
    setHiddenProp(this, isForcingUpdateKey, false)

    // Generate friendly name for debugging
    const initialName =
        this.displayName ||
        this.name ||
        (this.constructor && (this.constructor.displayName || this.constructor.name)) ||
        "<component>"
    const baseRender = render.bind(this)

    let isRenderingPending = false

    const reaction = new Reaction(`${initialName}.render()`, () => {
        if (!isRenderingPending) {
            // N.B. Getting here *before mounting* means that a component constructor has side effects (see the relevant test in misc.js)
            // This unidiomatic React usage but React will correctly warn about this so we continue as usual
            // See #85 / Pull #44
            isRenderingPending = true
            if (this[mobxIsUnmounted] !== true) {
                let hasError = true
                try {
                    setHiddenProp(this, isForcingUpdateKey, true)
                    if (!this[skipRenderKey]) Component.prototype.forceUpdate.call(this)
                    hasError = false
                } finally {
                    setHiddenProp(this, isForcingUpdateKey, false)
                    if (hasError) reaction.dispose()
                }
            }
        }
    })
    reaction.reactComponent = this
    reactiveRender[mobxAdminProperty] = reaction
    this.render = reactiveRender

    function reactiveRender() {
        isRenderingPending = false
        let exception = undefined
        let rendering = undefined
        reaction.track(() => {
            try {
                rendering = _allowStateChanges(false, baseRender)
            } catch (e) {
                exception = e
            }
        })
        if (exception) {
            throw exception
        }
        return rendering
    }

    return reactiveRender.call(this)
}

function observerSCU(nextProps, nextState) {
    if (isUsingStaticRendering()) {
        console.warn(
            "[mobx-react] It seems that a re-rendering of a React component is triggered while in static (server-side) mode. Please make sure components are rendered only once server-side."
        )
    }
    // update on any state changes (as is the default)
    if (this.state !== nextState) {
        return true
    }
    // update if props are shallowly not equal, inspired by PureRenderMixin
    // we could return just 'false' here, and avoid the `skipRender` checks etc
    // however, it is nicer if lifecycle events are triggered like usually,
    // so we return true here if props are shallowly modified.
    return !shallowEqual(this.props, nextProps)
}

function makeObservableProp(target, propName) {
    const valueHolderKey = newSymbol(`reactProp_${propName}_valueHolder`)
    const atomHolderKey = newSymbol(`reactProp_${propName}_atomHolder`)
    function getAtom() {
        // 如果不存在这个属性，那就定义一个。
        if (!this[atomHolderKey]) {
            // createAtom("reactive " + propName) 返回mobx中atom的一个实例对象
            // setHiddenProp 会根据 this是否包含atomHolderKey 来返回
            // 如果不包含atomHolderKey，就返回当前this对象(Object.defineProperty的原因)
            // 如果有了，那就返回只包含当前这个key的对象。
            setHiddenProp(this, atomHolderKey, createAtom("reactive " + propName))
        }
        // 不管如何，这里都会返回atom的实例对象。
        // 上面的代码相当于是 this[atomHolderKey] = createAtom("reactive " + propName)
        return this[atomHolderKey]
    }
    Object.defineProperty(target, propName, {
        configurable: true,
        enumerable: true,
        get: function() {
            // reportObserved这个函数会对当前this进行报告
            // 报告什么？mobx里去看, 你也可以猜得到。
            getAtom.call(this).reportObserved()
            return this[valueHolderKey]
        },
        set: function set(v) {
            if (!this[isForcingUpdateKey] && !shallowEqual(this[valueHolderKey], v)) {
                setHiddenProp(this, valueHolderKey, v)
                setHiddenProp(this, skipRenderKey, true)
                getAtom.call(this).reportChanged()
                setHiddenProp(this, skipRenderKey, false)
            } else {
                setHiddenProp(this, valueHolderKey, v)
            }
        }
    })
}
