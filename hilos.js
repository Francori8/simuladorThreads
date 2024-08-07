import {Ciclo} from "./instrucciones.js"

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
            console.log(this.proximaInstruccion.estaResuelto())
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
        
        let valorLectura
        if(this.memoriaCompartida.hayVariable(valor)){
                valorLectura = this.memoriaCompartida.verValor(valor)
        }else{
            valorLectura = this.memoriaLocal.verValor(valor)
        }
        
        estado.informar(new Estado(this.id, "Lectura", `local.${valor} : ${valorLectura}`   ))
        this.memoriaLocal.agregarVariable(valor, valorLectura)
    }

    resolverSegunValorFijo(valor , estado){
        if(valor ==="}"){return}
        if(this.memoriaLocal.hayVariable(valor)){return this.memoriaLocal.verValor(valor)}
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

    resolverDeclaracionVariableLocal(valor,fmemoria,estado){
        fmemoria(valor, this.memoriaLocal)
    }

    resolverEscritura(nombre, valor , estado){
        if(!this.memoriaCompartida.hayVariable(nombre)){
            this.memoriaLocal.agregarVariable(nombre, valor.resolverPuro(this)) 
        }else{
            estado.informar(new Estado(this.id, "Escritura" , `global.${nombre} : ${valor.resolverPuro(this)}`))
             this.memoriaCompartida.agregarVariable(nombre, valor.resolverPuro(this))
        }
        
    }

    resolverConIgualdad(vIzquierdo, vDerecho, estado){
        
        const valorIzquierdo = vIzquierdo.resolverPuro(this)
        const valorDerecho = vDerecho.resolverPuro(this)
        estado.informar(new Estado(this.id, "OP bool", `local.OP : ${valorIzquierdo == valorDerecho} (${valorIzquierdo} == ${valorDerecho})`))
        this.memoriaLocal.agregarVariable("OP", valorIzquierdo == valorDerecho)
    }
    
    resolverConMayor(vIzquierdo, vDerecho,estado){
        const valorIzquierdo = vIzquierdo.resolverPuro(this)
        const valorDerecho = vDerecho.resolverPuro(this)
        estado.informar(new Estado(this.id, "OP bool", `local.OP : ${valorIzquierdo > valorDerecho} (${valorIzquierdo} > ${valorDerecho})`))
        this.memoriaLocal.agregarVariable("OP", valorIzquierdo > valorDerecho)
    }

    resolverMayorOIgualdad(vIzquierdo,vDerecho,estado){
        const valorIzquierdo = vIzquierdo.resolverPuro(this)
        const valorDerecho = vDerecho.resolverPuro(this)
        estado.informar(new Estado(this.id, "OP bool", `local.OP : ${valorIzquierdo >= valorDerecho} (${valorIzquierdo} >= ${valorDerecho})`))
        this.memoriaLocal.agregarVariable("OP", valorIzquierdo >= valorDerecho)    
    }

    resolverMenor(vIzquierdo,vDerecho,estado){
        const valorIzquierdo = vIzquierdo.resolverPuro(this)
        const valorDerecho = vDerecho.resolverPuro(this)
        estado.informar(new Estado(this.id, "OP bool", `local.OP : ${valorIzquierdo < valorDerecho} (${valorIzquierdo} < ${valorDerecho})`))
        this.memoriaLocal.agregarVariable("OP", valorIzquierdo < valorDerecho)    
    }

    resolverMenorOIgual(vIzquierdo,vDerecho,estado){
        const valorIzquierdo = vIzquierdo.resolverPuro(this)
        const valorDerecho = vDerecho.resolverPuro(this)
        estado.informar(new Estado(this.id, "OP bool", `local.OP : ${valorIzquierdo <= valorDerecho} (${valorIzquierdo} <= ${valorDerecho})`))
        this.memoriaLocal.agregarVariable("OP", valorIzquierdo <= valorDerecho)    
    }

    resolverCondicional(condicion, estado){
        if(condicion.resolverPuro(this) ){
                this.borrarProximoCasoFalsoSiExiste()
        }else{
                this.irHastaElElseSiExiste()
        }

    }

    resolverWhile(condicion,maximo, estado){
        if(condicion.resolverPuro(this)){
            this.bloque.unshift( new Ciclo(condicion, this.instruccionesHastaElFinalDeBloque(), maximo)) 
        }else{
            this.borrarHastaFinDeBloqueDesde(0)
        }
       
    }

    resolverMaximoCiclos(estado){
        estado.informarEstadoFinalizacionPorMaximoCiclos()
    }

    resolverSeguirCiclo(condicion, ciclo,estado){
        if(condicion.resolverPuro(this)){
            ciclo.reiniciar()
        }else{

            ciclo.terminado()
            
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

    valorFijoSegun(valor){
        if(this.memoriaLocal.hayVariable(valor)){
            return this.memoriaLocal.verValor(valor)
        }

        return eval(valor)
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
           
            if(this.bloque[i].esInstruccionConBloque()){
                cantBloques ++
            }
            if(this.bloque[i].esElse() || this.bloque[i].esFinDeBloque() ){
                cantBloques --
            }
           
            i++
        }

        return i
    }

    instruccionesHastaElFinalDeBloque(){
        return this.bloque.splice(0, this.indiceDelBloqueQueCierraActual(0))
    }


    borrarHastaFinDeBloqueDesde(indice){
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