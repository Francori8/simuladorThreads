export default class Hilo{
    constructor(id, repeticion, cache, memoriaCompartida){
        this.id = id
        this.repeticion = repeticion
        this.memoriaLocal = cache
        this.memoriaCompartida = memoriaCompartida
        this.proximaInstruccion 
        this.bloque = []
    }

    conId(id){
        return this.id === id
    }

    agregarInstruccion(instruccion){
        this.bloque.push(instruccion)
    }

    cantidadDeRep(){
        return this.repeticion
    }

}