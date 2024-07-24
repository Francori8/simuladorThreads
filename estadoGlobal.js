export default class EstadoGlobal{
    constructor(threads){
        this.probabilidad = 0   
        this.estados = []
        this.threads = threads
    }

    informar(estado){
        this.estados.push(estado)
    }

    mostrarTraza(){
        console.log(this.estados)
    }

    setProbabilidad(probabilidad){
        this.probabilidad = probabilidad
    }

    decidirQuienSigue(thread){
        this.sortearSuerte()
        const threadPreaprados = this.threadPreparados()
        if(threadPreaprados.length == 0){
            this.mostrarEstados()
        }else{
            // thread bloquear el actual
            
            threadPreaprados[0].ejecutarSiguienteInstruccion(this)
        }
    }

    mostrarEstados(){
        console.log("fin ejecucion")
    }

    sortearSuerte(){
        this.threads.sort(() => Math.random() - this.probabilidad)
    }
    

    resolver(){
        this.sortearSuerte()
        this.threadPreparados()[0].ejecutarSiguienteInstruccion(this)
        
    }

    threadPreparados(){
        return this.threads.filter(th => th.estaPreparado())
    }
    

}



class Estado{
    constructor(idThread, operacion){
        this.thread = idThread
        this.operacion = operacion
    }
}