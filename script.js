import Memoria from "./memoria.js"
import Hilo  from "./hilos.js"
import { Sumar ,Imprimir , ValorFijo , Escritura, Lectura, Igualdad , FinDeBloque, Condicional , Else, DeclaracionVariableLocal, While, Mayor,MayorOIgual, Menor, MenorOIgual} from "./instrucciones.js"
import EstadoGlobal from "./estadoGlobal.js"
import ejemplos from "./ejemplo.js"


const $ = arg => document.querySelector(arg)

const consola = $("#consola") 

$("textarea").addEventListener("keydown", agregarTab)

function agregarTab(e) {
    const tab = 9
    if(e.keyCode === tab) { // 
        // get caret position/selection
        
        const textArea = e.target
        const inicio = textArea.selectionStart
        const  final = textArea.selectionEnd
        const valorAnterior = textArea.value
        textArea.value = valorAnterior.substring(0,inicio) + "\t" + valorAnterior.substring(final) 
        textArea.selectionStart = inicio + 1
        textArea.selectionEnd = inicio + 1

        e.preventDefault();
    }
};


const averiguarProbabilidad = () => {return $("#porcentaje").value * ((100/$("#porcentaje").max)/100) }

function cargar(){
    const btn = $("#ejecutar")
    crearBotones($("#contenedorBotones"), ejemplos , modificarTexto)
    btn.addEventListener("click", ejecutarCodigo)
}

function modificarTexto(e){
    const idBtn = e.target.dataset.btnid 
    $("#codigo").value = ejemplos.find(ej => ej.id == idBtn).texto
}

function ejecutarCodigo(){
    const mem = new Memoria()
    consola.innerText = ""
    const threads = parsearTexto(mem)
    const estado = new EstadoGlobal(threads, mem)
    estado.setProbabilidad(averiguarProbabilidad())
    estado.resolver()
    $("#variables").innerText = mem.mostrarMemoria().join(" ")
    $("#traza").innerHTML = estado.mostrarTraza().join("")
    
}

function parsearTexto(mem){
    const texto = $("#codigo").value.trim().replaceAll(" ", "").replaceAll("\t","").split("\n").filter(string => string  != "")
    const global = texto.filter(string => string.startsWith("global")) 
    establecerMemoria(global,mem)
    const arrayConThreads = separarCadaThread(texto)
    const objetosThreads = crearThreads(arrayConThreads,mem)
    return objetosThreads
}

function crearThreads(arrayTexto,mem){
    let idThread = 0
    const arrayTextConRep = []
    arrayTexto.forEach(value => {
        const num = parseInt(value[0].substring(6).replace("(","").replace(")",""))
        for (let index = 0; index < num; index++) {
            arrayTextConRep.push(value);
            
        }
    })
    return arrayTextConRep.map(value => 
        new Hilo( idThread++ ,  new Memoria(), mem, crearInstruccionCon(value.toSpliced(0,1),mem))
    )
}

function separarCadaThread(texto){

    const textoThreas = texto.filter(string => !string.startsWith("global")  )
    const threadSeparados = []
    textoThreas.forEach(string => {
        if(string.startsWith("Thread")){
            threadSeparados.push([string])
        }else{
            threadSeparados[threadSeparados.length - 1].push(string)
        }
    })
 
    return threadSeparados

}

function establecerMemoria(arraysDeGlobal , mem){
    arraysDeGlobal.forEach(string=>
        manejarMemoria(string.substring(6) , mem) 
    )
}

function manejarMemoria(string,  mem){
    if(string.startsWith("Int")){
        const vari = string.substring(3).replace(";","").split("=")
        mem.agregarVariable(vari[0] , parseInt(vari[1]))
    }
    if(string.startsWith("String")){
        const vari = string.substring(6).replace(";","").split("=")
        mem.agregarVariable(vari[0] , vari[1])
    }
    if(string.startsWith("Bool")){
        const vari = string.substring(4).replace(";","").split("=")
        mem.agregarVariable(vari[0], true && eval(vari[1]))
    }
    if(string.startsWith("List")){
        const vari = string.substring(4).replace(";","").split("=")
        mem.agregarVariable(vari[0] , eval(vari[1]))
    }

}

function crearInstruccionCon(instruccionesString,mem){
   return instruccionesString.map(string => instruccionSegunString(string,mem) )
}

function instruccionSegunString(string,mem){
    
    if(string.startsWith("local")){
        const stringAResolver = string.substring(5)
        return new DeclaracionVariableLocal(stringAResolver , manejarMemoria)
    }
    if(string.startsWith("while")){
        const stringAResolver = string.substring(5).replace("(","").replace(")","").replace("{","")
        return new While(instruccionSegunString(stringAResolver, mem), $("input[name='limite']:checked").value)
    }
    if(string.startsWith("if")){
        const condicion = string.substring(2).replace("(","").replace(")","").replace("{","")
        console.log(condicion)
        return new Condicional(instruccionSegunString(condicion,mem))
    }
    if(string.includes("else")){
        return new Else()
    }

    if(tieneEscritura(string) ){
        const asignacion = string.split("=")

        const variableAEscribir = asignacion.shift()
        return new Escritura(variableAEscribir, instruccionSegunString(asignacion.join("="),mem))
    }

    if(string.includes("&&")){   
        const condicones = string.split("&&")
        const primeraCondicion = condicones.shift()
        return new YLogico(instruccionSegunString(primeraCondicion , mem), instruccionSegunString(condicones.join("&&") , mem))
    }
    if(string.includes("||")){
        const condicones = string.split("||")
        const primeraCondicion = condicones.shift()
        return new OLogico(instruccionSegunString(primeraCondicion , mem), instruccionSegunString(condicones.join("||") , mem))
    }

    if(string.includes(">=")){
        const asignacion = string.split(">=")
        const variableAEscribir = asignacion.shift()
        return new MayorOIgual(instruccionSegunString(variableAEscribir,mem), instruccionSegunString(asignacion.join("") , mem))
    }
    if(string.includes("<=")){
        const asignacion = string.split("<=")
        const variableAEscribir = asignacion.shift()
        return new MenorOIgual(instruccionSegunString(variableAEscribir,mem), instruccionSegunString(asignacion.join("") , mem))
    }    
    if(string.includes(">")){
        const asignacion = string.split(">")
        const variableAEscribir = asignacion.shift()
        return new Mayor(instruccionSegunString(variableAEscribir,mem), instruccionSegunString(asignacion.join("") , mem))
    }
    if(string.includes("<")){
        const asignacion = string.split("<")
        const variableAEscribir = asignacion.shift()
        return new Menor(instruccionSegunString(variableAEscribir,mem), instruccionSegunString(asignacion.join("") , mem))
    }
    if(string.includes("==")){
        const asignacion = string.split("==")
        
        const variableAEscribir = asignacion.shift()
        return new Igualdad(instruccionSegunString(variableAEscribir,mem), instruccionSegunString(asignacion[0] , mem))
    }
    if (string.includes("+")){
        const instruccion = string.split("+")        
        const restoC = instruccion.shift()        
        return new Sumar(instruccionSegunString(restoC, mem), instruccionSegunString(instruccion.join("+"), mem))
    }
    if(string.startsWith("print")){
        const imprimir = string.substring(5).replace("(","").replace(")","")
        return new Imprimir(instruccionSegunString(imprimir,mem) , consola)
    }
    if(mem.hayVariable(string)){
        return new Lectura(string)
    }
    if(string == "}"){
        return new FinDeBloque
    }
    
    return new ValorFijo(string)
}


function crearBotones(contenedor, elementos, funcionOnClick){
    const botonesHTML = elementos.map(val => {
        return `<button data-btnid=${val.id} title="${val.razon}"> ${val.id}</button>`
    })

    botonesHTML.forEach(elemHtml => {
        contenedor.innerHTML += elemHtml
    })
    contenedor.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", funcionOnClick)
    })

}

function tieneEscritura(string){
    let i = 0
    let b = false
    while(!b && string.length > i){
            if(string[i] == ">" || string[i] =="<" ){
                break
            }
            b = (string[i] == "=") 
            i ++
    }
    
    return b && (string[i] !="=") 
}




window.addEventListener("load", cargar)