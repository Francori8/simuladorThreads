export default class Hilo{
    constructor(id,  cache, memoriaCompartida, bloque){
        this.id = id
        this.constantesParaMemoria = {}
        this.memoriaLocal = cache
        this.memoriaCompartida = memoriaCompartida
        this.bloque = bloque
        this.proximaInstruccion = bloque.shift()
        this.preparado = true
        this.contexto = this
    }

    conId(id){
        return this.id === id
    }

    ejecutarSiguienteInstruccion(estado){
        this.ejecutarInstruccionActual(estado)
        if(this.bloque.length == 0){
            this.preparado = false
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
    resolverConImprimir(valor, estado){
        estado.informar(new Estado(this.id,"Imprimir",valor ) )
    }
    resolverConSuma(valor, valor1 , estado){
        
        let primerValor = valor.resolverPuro(this)
        let segundoValor = valor1.resolverPuro(this)
        estado.informar(new Estado(this.id, "OP arit" , `local.OP : ${primerValor + segundoValor} (${primerValor} + ${segundoValor})`))
        this.memoriaLocal.agregarVariable("OP", primerValor + segundoValor )
    }

    resolverEscritura(nombre, valor , estado){
        
        estado.informar(new Estado(this.id, "Escritura" , `global.${nombre} : ${valor.resolverPuro(this)}`))
        this.memoriaCompartida.agregarVariable(nombre, valor.resolverPuro(this))
    }

    resolverConIgualdad(vIzquierdo, vDerecho, estado){
        console.log(vIzquierdo, vDerecho)
        const valorIzquierdo = vIzquierdo.resolverPuro(this)
        const valorDerecho = vDerecho.resolverPuro(this)
        estado.informar(new Estado(this.id, "OP bool", `local.OP : ${valorIzquierdo == valorDerecho} (${valorIzquierdo} == ${valorDerecho})`))
        this.memoriaLocal.agregarVariable("OP", valorIzquierdo == valorDerecho)
    }   

    resolverCondicional(condicion, estado){
        
        if(condicion.resolverPuro(this) ){
                this.borrarProximoCasoFalsoSiExiste()
        }else{
                this.irHastaElElseSiExiste()
        }

    }

    resolverFinDeBloque(estado){
        console.log("final bloque")
    }
   
    valorLocalDe(nombre){
        if(!this.memoriaLocal.hayVariable(nombre)){
            return this.memoriaCompartida.verValor(nombre)
        }

        return this.memoriaLocal.verValor(nombre)
    }

    borrarProximoCasoFalsoSiExiste(){
        
        const indice = this.indiceDelBloqueQueCierraActual(0)
        if(this.bloque[indice].esElse()){
            this.borrarHastaFinDeBloqueDesde(indice)
        }
    }

    indiceDelBloqueQueCierraActual(indice){
        let i = indice
        let cantBloques = 1
        while(cantBloques > 0){
            console.log(this.bloque[i])
            if(this.bloque[i].esInstruccionConBloque()){
                cantBloques ++
            }
            if(this.bloque[i].esElse() || this.bloque[i].esFinDeBloque() ){
                cantBloques --
            }
            console.log(cantBloques)
            i++
        }

        return i
    }


    borrarHastaFinDeBloqueDesde(indice){
    // caso borde de if adentro de else y probablemtne otros parecidos, no usar findIndex, buscarIndices por uno
        this.bloque.splice(indice , this.indiceDelBloqueQueCierraActual(indice))
    }

    irHastaElElseSiExiste(){
        this.bloque.splice(0, this.indiceDelBloqueQueCierraActual(0)) 
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