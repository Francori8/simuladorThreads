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
        this.ejecutarInstruccionActual(estado)
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

    ejecutarInstruccionActual(estado){
        console.log("ejecutado", this.proximaInstruccion,this)
        this.proximaInstruccion.resolver(this,estado)
        
    }

    estaPreparado(){
        return this.preparado
    }

    resolverLectura(valor, estado){
        estado.informar(new Estado(this.id, "Lectura", `local.${valor} : ${this.memoriaCompartida.verValor(valor)}`   ))
        this.memoriaLocal.agregarVariable(valor, this.memoriaCompartida.verValor(valor))
    }

    resolverSegunValorFijo(valor , estado){
        if(valor ==="}"){return}
        eval(valor)
    }
    resolverConSuma(valor, valor1 , estado){
        
        let primerValor = valor.resolverPuro(this)
        let segundoValor = valor1.resolverPuro(this)
        estado.informar(new Estado(this.id, "Operacion" , `local.OP : ${primerValor + segundoValor} (${primerValor} + ${segundoValor})`))
        this.memoriaLocal.agregarVariable("OP", primerValor + segundoValor )
    }

    resolverEscritura(nombre, valor , estado){
        estado.informar(new Estado(this.id, "Escritura" , `global.${nombre} : ${this.memoriaLocal.verValor("OP")}`))
        this.memoriaCompartida.agregarVariable(nombre, this.memoriaLocal.verValor("OP"))
    }

    valorLocalDe(nombre){
        return this.memoriaLocal.verValor(nombre)
    }

}


class Estado{
    constructor(idThread, operacion, texto){
        this.thread = idThread
        this.operacion = operacion
        this.texto = texto
    }

    threadId(){
        return this.thread
    }
    estiloDeOperacion(){
        return this.operacion
    }

    desarrollo(){
        return this.texto
    }
  
}