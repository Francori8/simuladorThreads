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
        return this.estados.map(value => `<div class="elementoTraza">
                    <h3 class="thread">TH : ${value.threadId()} </h3>
                    <div class="contenedorTraza">
                        <p class="operacion">${value.estiloDeOperacion()}</p>
                        <p class="accion">${value.desarrollo()}</p>
                    </div>
            </div>`   )
        
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


