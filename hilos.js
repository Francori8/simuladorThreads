export default class Hilo{
    constructor(id,  cache, memoriaCompartida, bloque){
        this.id = id
        this.memoriaLocal = cache
        this.memoriaCompartida = memoriaCompartida
        this.bloque = bloque
        this.proximaInstruccion = bloque.shift()
        this.preparado = true
    }

    conId(id){
        return this.id === id
    }

    ejecutarSiguienteInstruccion(estado){
        this.ejecutarInstruccionActual()
        if(this.bloque.length == 0){
            this.preparado = false
            console.log("final bloque")
            estado.decidirQuienSigue(this)
        }else{
            if(this.proximaInstruccion.estaResuelto()){
                this.proximaInstruccion = this.bloque.shift()
            }
            estado.decidirQuienSigue(this)
        }
    }

    ejecutarInstruccionActual(){
        console.log("ejecutado", this.proximaInstruccion,this)
        this.proximaInstruccion.resolver(this)
        
    }

    estaPreparado(){
        return this.preparado
    }

    resolverLectura(valor){
        this.memoriaLocal.agregarVariable(valor, this.memoriaCompartida.verValor(valor))
    }

    resolverSegunValorFijo(valor){
        if(valor ==="}"){return}
        eval(valor)
    }
    resolverConSuma(valor, valor1){
        
        let primerValor = valor.resolverPuro(this)
        let segundoValor = valor1.resolverPuro(this)
        this.memoriaLocal.agregarVariable("OP", primerValor + segundoValor )
    }

    resolverEscritura(nombre, valor){
        this.memoriaCompartida.agregarVariable(nombre, this.memoriaLocal.verValor("OP"))
    }

    valorLocalDe(nombre){
        return this.memoriaLocal.verValor(nombre)
    }

}