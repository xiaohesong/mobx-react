/* eslint-disable react/display-name */
import React, { Component, forwardRef, memo } from "react"
import { observer as observerLite, Observer } from "mobx-react-lite"

import { makeClassComponentObserver } from "./observerClass"

const hasSymbol = typeof Symbol === "function" && Symbol.for

// Using react-is had some issues (and operates on elements, not on types), see #608 / #609
// 下面两个是等效的，因为react element的`$$typeof`属性的值也是一个Symbol。
const ReactForwardRefSymbol = hasSymbol
    ? Symbol.for("react.forward_ref")
    : typeof forwardRef === "function" && forwardRef(() => {})["$$typeof"]

// 和上面同理，就是一个'Symbol(react.memo)'
const ReactMemoSymbol = hasSymbol
    ? Symbol.for("react.memo")
    : typeof memo === "function" && memo(() => {})["$$typeof"]

/**
 * Observer function / decorator
 */
export function observer(componentClass) {
    // 这个就是和你说observer的组件已经被inject过了
    // 所以提示你说先observer再inject
    // 所以应用的时候是：
    // @inject('myStore')
    // @observer
    // class X extends React.Component {}

    if (componentClass.isMobxInjector === true) {
        console.warn(
            "Mobx observer: You are trying to use 'observer' on a component that already has 'inject'. Please apply 'observer' before applying 'inject'"
        )
    }

    // 这个就是检测你是不是用了memo，用了就报错，因为mobx会给你应用上去
    if (ReactMemoSymbol && componentClass["$$typeof"] === ReactMemoSymbol) {
        throw new Error(
            "Mobx observer: You are trying to use 'observer' on function component wrapped to either another observer or 'React.memo'. The observer already applies 'React.memo' for you."
        )
    }

    // Unwrap forward refs into `<Observer>` component
    // we need to unwrap the render, because it is the inner render that needs to be tracked,
    // not the ForwardRef HoC
    // 下面会判断是不是forwardRef的组件，如果是，那就在确定render为function的情况下，对render进行包裹Observer
    if (ReactForwardRefSymbol && componentClass["$$typeof"] === ReactForwardRefSymbol) {
        const baseRender = componentClass.render
        if (typeof baseRender !== "function")
            throw new Error("render property of ForwardRef was not a function")
        return forwardRef(function ObserverForwardRef() {
            return <Observer>{() => baseRender.apply(undefined, arguments)}</Observer>
        })
    }

    // Function component
    // 如果是函数组件的情况
    // !componentClass.prototype 这个是针对于箭头函数
    if (
        typeof componentClass === "function" &&
        (!componentClass.prototype || !componentClass.prototype.render) &&
        !componentClass.isReactClass &&
        !Object.prototype.isPrototypeOf.call(Component, componentClass)
    ) {
        return observerLite(componentClass)
    }

    // 既不是函数组件也不是foraref包裹的组件，那就是类组件了
    return makeClassComponentObserver(componentClass)
}
