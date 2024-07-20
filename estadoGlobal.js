export default class EstadoGlobal{
    constructor(threads){
        this.probabilidad = 0
        this.estados =   []
        this.threads = threads
    }

    informar(estado){
        this.estados.push(estado)
    }

    setProbabilidad(probabilidad){
        this.probabilidad = probabilidad
    }

    decidirQuienSigue(thread){
        
    }

    resolver(){
        this.threads.sort(() => Math.random() - this.probabilidad)
      
    }
    

}