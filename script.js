import Memoria from "/memoria.js"
import Hilo  from "/hilos.js"
import { Sumar ,Imprimir , ValorFijo , Escritura, Lectura} from "./instrucciones.js"
import EstadoGlobal from "./estadoGlobal.js"


const $ = arg => document.querySelector(arg)

const consola = $("#consola") 


function cargar(){
    const btn = $("#ejecutar")
    
    
    btn.addEventListener("click", ejecutarCodigo)
}


function ejecutarCodigo(){
    const mem = new Memoria()
    consola.innerText = ""
    const threads = parsearTexto(mem)
    const estado = new EstadoGlobal(threads, mem)
    estado.setProbabilidad(averiguarProbabilidad())
    estado.resolver()
    
    $("#variables").innerText = mem.mostrarMemoria().join(" ")
    // mostrar traza
    estado.mostrarTraza()

}

const averiguarProbabilidad = () => {return $("#porcentaje").value * ((100/$("#porcentaje").max)/100) }

function parsearTexto(mem){
    const texto = $("#codigo").value.trim().replaceAll(" ", "").split("\n").filter(string => string  != "")
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
    if(string.startsWith("List")){
        const vari = string.substring(4).replace(";","").split("=")
        mem.agregarVariable(vari[0] , eval(vari[1]))
    }

}

function crearInstruccionCon(instruccionesString,mem){
   return instruccionesString.map(string => instruccionSegunString(string,mem) )
}

function instruccionSegunString(string,mem){
    if(string.includes("=")){
        const asignacion = string.split("=")
        console.log(asignacion)
        return new Escritura(asignacion[0], instruccionSegunString(asignacion[1],mem))
    }
    if (string.includes("+")){
        const instruccion = string.split("+")        
        const restoC = instruccion.shift()        
        return new Sumar(instruccionSegunString(restoC, mem), instruccionSegunString(instruccion.join("+"), mem))
    }
    if(string.startsWith("print")){
        const imprimir = string.substring(5).replace("(","").replace(")","")
        return new Imprimir(imprimir + " ", consola)
    }
    if(mem.hayVariable(string)){
        return new Lectura(string)
    }
    
    return new ValorFijo(string)
}


window.addEventListener("load", cargar)