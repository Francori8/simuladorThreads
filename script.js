import Memoria from "/memoria.js"
import Hilo  from "/hilos.js"
import { Sumar , Asignacion , ValorFijo } from "./instrucciones.js"
import EstadoGlobal from "./estadoGlobal.js"


const $ = arg => document.querySelector(arg)

function cargar(){
    const btn = $("#ejecutar")
    btn.addEventListener("click", ejecutarCodigo)
}


function ejecutarCodigo(){
    const mem = new Memoria()
    const threads = parsearTexto(mem)
    const todosThreads = multiplicarSegunRepeticionThreads(threads)
    const estado = new EstadoGlobal(todosThreads)

    estado.resolver()

    console.log(threads)
    console.log(todosThreads)
    console.log(estado)
    console.log(mem)

}

function parsearTexto(mem){
    let texto = $("#codigo").value.trim().replaceAll(" ", "").split("\n")
    const threads = []
    let idThread = 0    
    texto = texto.filter(string => string  != "")
    
    texto.forEach(string => {
        if(string.startsWith("global")){
            manejarMemoria(string.substring(6) , mem) 
            
        }else{
            if(string.startsWith("Thread")){
                const numero = string.substring(6).replace("(","").replace(")","")
                idThread ++
                const hilo = new Hilo(idThread,parseInt(numero), new Memoria(), mem)
                
                threads.push(hilo)
                
            }else{
                const instruccion = crearInstruccionCon(string)
                threads.find(hilo => hilo.conId(idThread)).agregarInstruccion(instruccion)
            }
        }
        
    });
    return threads

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
}


function crearInstruccionCon(string){
    if(string.includes("=")){
        const asignacion = string.split("=")
        return new Asignacion(asignacion[0], crearInstruccionCon(asignacion[1]))
    }
    if (string.includes("+")){
        const suma = string.split("+")
        return new Sumar(crearInstruccionCon(suma[0]), crearInstruccionCon(suma[1]))
    }
    
    return new ValorFijo(string)
}

function multiplicarSegunRepeticionThreads(threads){
    const todosThreads=[]
    threads.forEach((curre =>{
       for (let index = 0; index < curre.cantidadDeRep(); index++) {
           todosThreads.push(curre)
       }
   }))
   return todosThreads
}

window.addEventListener("load", cargar)