class DNContext {
    constructor(internal) {
        this.internal = internal
        this.parent = null
        this.children = []
    }

    addChild(ctx) {
        ctx.parent = this
        this.children.push(ctx)
    }

    parse() {
        return ''
    }
}
var packageName = ''
var basic_type_signature = new Map([
    ['char', 'C'],
    ['int', 'I'],
    ['double', 'D'],
    ['float', 'F'],
    ['byte', 'B'],
    ['short', 'S'],
    ['long', 'J'],
    ['boolean', 'Z'],
    ['void', 'V']
])

var basic_type_conversion = function (type) {
    if(type === 'float') return 'double'

    var intArray = ['short', 'byte', 'long']
    if(intArray.includes(type)) return 'int'

    if(type === 'boolean') return 'bool'

    if(type === 'char') return 'String'
    
    return type;
}

var basic_type_wrapper = ['byte', 'short', 'long', 'long', 'float', 'char']

class DNArgumentContext extends DNContext {
    constructor(internal, name, type) {
        super(internal)
        this.name = name
        this.type = type
    }
}

class DNMethodContext extends DNContext {
    constructor(internal) {
        super(internal)
        var internalChildren = internal.children[1].children
        this.methodName = internalChildren[1].start.text
        this.returnType = internalChildren[0].start.text
        this.args = []
    }

    parse() {
        var result = '\n  ' +  this.methodReturnType() + ' ' + this.methodName + '(' + this.methodArgs() + ')' + ' {\n'
        result += '    ' + this.methodImpl()
        result += '  }'
        return result
    }

    methodReturnType() {
        return basic_type_conversion(this.returnType);
    }

    methodImpl() {
        // this.basicTypeWrapper()
        var callerPrefix = ' invoke(\'' + this.methodName + '\', '
        var args = '[' + this.basicTypeWrapper() + '], '
        var returnType = '\'' + this.JNIReturnType() + '\''
        return 'return' + callerPrefix + args + returnType + ');\n'
    }

    basicTypeWrapper() {
        var types = this.args.map(arg => arg.type)
        var argNames = this.args.map(arg => arg.name)
        var wrapperArgs = ''
        for(var i = 0; i < argNames.length; i++) {
            if(i != 0) {
                wrapperArgs += ','
            }

            if(basic_type_wrapper.includes(types[i])) {
                if(types[i] == 'char') {
                    wrapperArgs += 'char(' + argNames[i] + '.codeUnitAt(0))'
                    continue
                }

                wrapperArgs += types[i] + '(' + argNames[i] + ')'
                continue
            }
            
            wrapperArgs += argNames[i]
        }
        return wrapperArgs
    }

    JNIReturnType() {
        var result = basic_type_signature.get(this.returnType)
        if (result == undefined) {
            //todo class jni signature
            if(this.returnType == 'String') {
                result = 'Ljava/lang/String;'
            }
        }
        return result
    }

    methodArgs() {
        var argList = ''
        this.args.forEach((element, index) => {
            var argType = basic_type_conversion(element.type)
            if(index == this.args.length - 1){
                argList += argType + ' ' + element.name
            }else{
                argList += argType + ' ' + element.name + ', '
            }
        })
        return argList
    }
}


class DNClassContext extends DNContext {
    constructor(internal) {
        super(internal)
        var internalChildren = internal.children[0]
        this.name = internalChildren.children[2].start.text
        this.superClass = []
        this.methods = []
    }

    parse() {
        var result = 'class ' + this.name + ' extends JObject'
        result += ' {\n'
        result += '  ' + this.name + '() : super(\"' + packageName + this.name + '\");\n'
        this.methods.forEach(element => {
            var parseRet = element.parse()
            result += parseRet ? parseRet + '\n' : ''
        })
        result += '\n}'
        return result
    }
}

class DNImportContext extends DNContext {
    constructor(internal) {
        super(internal)
        var frameworkCtx = internal.frameworkName
        var headerCtx = internal.headerName
        if (frameworkCtx) {
            this.package = frameworkCtx.start.text
        }
        if (headerCtx) {
            this.header = headerCtx.start.text
        }
        if (!frameworkCtx && !headerCtx) {
            if (internal.children.length == 2 && internal.children[1]) {
                var content = internal.children[1].children[1].symbol.text
                var components = content.split('/')
                if (components.length == 2) {
                    this.package = components[0]
                    this.header = components[1]
                } else {
                    this.header = content
                }
            }
        }
    }

    parse() {
        var packageName = null
        var result = 'import \''
        if (this.package) {
            packageName = this.package.toLowerCase()
            result += 'package:' + packageName + '/'
        }
        if (this.header) {
            result += this.header.toLowerCase().replace(/\.h$/g, '') + '.dart\';'
        } else if (packageName) {
            result += packageName + '.dart\';'
        }
        
        return result
    }
}

class DNPackageContext extends DNContext {
    constructor(internal) {
        super(internal)
        packageName += internal.stop.text + '/'
    }
}

class DNRootContext extends DNContext {
    constructor(internal) {
        super(internal)
    }

    parse() {
        var result = ""
        var packageSet = new Set()
        result += "import 'package:dart_native/dart_native.dart';\n"
        result += "import 'package:dart_native_gen/dart_native_gen.dart';\n"
        result += this.children.map(ctx => ctx.parse()).join('\n\n')
        packageSet.add('dart_native')
        packageSet.add('dart_native_gen')
        return {
            dartCode: result,
            packages: packageSet
        }
    }
}

exports.DNRootContext = DNRootContext
exports.DNPackageContext = DNPackageContext
exports.DNImportContext = DNImportContext
exports.DNClassContext = DNClassContext
exports.DNMethodContext = DNMethodContext
exports.DNArgumentContext = DNArgumentContext
