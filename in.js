"use strict"

function _instanceof(left, right) {
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left)
    } else {
        return left instanceof right
    }
}

function _classCallCheck(instance, Constructor) {
    if (!_instanceof(instance, Constructor)) {
        throw new TypeError("Cannot call a class as a function")
    }
}

function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
        var descriptor = props[i]
        descriptor.enumerable = descriptor.enumerable || false
        descriptor.configurable = true
        if ("value" in descriptor) descriptor.writable = true
        Object.defineProperty(target, descriptor.key, descriptor)
    }
}

function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps)
    if (staticProps) _defineProperties(Constructor, staticProps)
    return Constructor
}

function _defineProperty(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        })
    } else {
        obj[key] = value
    }
    return obj
}

var A =
    /*#__PURE__*/
    (function() {
        function A() {
            _classCallCheck(this, A)

            _defineProperty(this, "myName", "myName")

            _defineProperty(this, "myAge", 18)
        }

        _createClass(A, [
            {
                key: "myFunc",
                value: function myFunc() {}
            },
            {
                key: "say",
                value: function say() {}
            }
        ])

        return A
    })()

A
