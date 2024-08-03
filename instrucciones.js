import { ListaCircular } from "./listaCircular.js"

class Instruccion {
   constructor(){
    this.resuelto = false
   }
    
    estaResuelto(){
        return this.resuelto
    }

    esElse(){
        return false
    }

    esFinDeBloque(){
        return false
    }
    reiniciar(){
        this.resuelto = false
    }

    esInstruccionConBloque(){
        return false
    }
}

export class DeclaracionVariableLocal extends Instruccion{
    constructor(string, funcionAMemoria){
        super()
        this.escritura = string
        this.funcion = funcionAMemoria
    }

    resolver(hilo,  estado){
        this.resuelto = true
        hilo.resolverDeclaracionVariableLocal( this.escritura, this.funcion,estado)
    }
}

export class Imprimir extends Instruccion{
    constructor(valor, lugarAEscribir){
        super()
        this.valor = valor
        this.escritura = lugarAEscribir
    }

    resolver(hilo,estado){
        this.resuelto = true
        
        const valorAEscribir =  this.valor.resolverPuro(hilo)
        this.escritura.innerHTML += `<p>${valorAEscribir}</p>`
        hilo.resolverConImprimir(valorAEscribir, estado)
    }

    resolverPuro(hilo){
         
    }
}

export class Lectura extends Instruccion{
    constructor(valor){
        super()
        this.valor = valor
    }

    resolver(hilo,estado){
        
        this.resuelto = true
        hilo.resolverLectura(this.valor , estado)
    }

    resolverPuro(hilo){
        return hilo.valorLocalDe(this.valor)
    }

}

export class Escritura extends Instruccion{
    constructor(nombre, valor){
        super()
        this.nombre = nombre
        this.valor = valor
    }

    reiniciar(){
        super.reiniciar()
        this.valor.reiniciar()
        
    }

    resolver(hilo,estado){
        
        if(!this.valor.estaResuelto()){
            this.valor.resolver(hilo,estado)
        }else{
            this.resuelto = true
            hilo.resolverEscritura(this.nombre, this.valor , estado)
        }
    }
    
}

export class Igualdad extends Instruccion{
    constructor(valorIzquierdo, valorDerecho){
        super()
        this.valorIzquierdo = valorIzquierdo
        this.valorDerecho = valorDerecho
    }

    reiniciar(){
        super.reiniciar()
        this.valorIzquierdo.reiniciar()
        this.valorDerecho.reiniciar()
    }

    resolver(hilo,estado){
        
        if(!this.valorIzquierdo.estaResuelto()){
            this.valorIzquierdo.resolver(hilo,estado)
        }else if(!this.valorDerecho.estaResuelto()){
            this.valorDerecho.resolver(hilo,estado)
        }else{
            this.resuelto = true
            hilo.resolverConIgualdad(this.valorIzquierdo,this.valorDerecho , estado)
        }
    }

    resolverPuro(hilo){
        return hilo.valorLocalDe("OP")
    }
}

export class Condicional extends Instruccion{
    constructor(condicion){
        super()
        this.condicion = condicion
        this.valorDeVerdad
        
    }

    reiniciar(){
        this.condicion.reiniciar()
    }

    resolver(hilo,estado){
        if(!this.condicion.estaResuelto()){
            this.condicion.resolver(hilo,estado)
        }else{
            this.resuelto = true
            hilo.resolverCondicional(this.condicion,estado)
        }
    }



    esInstruccionConBloque(){
        return true
    }
    
    
}

export class Ciclo extends Instruccion{
    constructor(condicion, bloque, maximo){
        super()
        this.condicion = condicion
        this.bloque  = new ListaCircular(bloque)
        this.maximo = maximo
        this.resolviendo = false
    
    }

    terminado(){
        this.resuelto = true
    }
    reiniciar(){
        super.reiniciar()
        this.maximo--
        this.condicion.reiniciar()
        this.bloque.reiniciarTodos()
    }

    resolver(hilo, estado){

        if(this.maximo === 0){
            this.resuelto = true
            // informar de maximas vueltas se llego
            hilo.resolverMaximoCiclos(estado)
           return
        }

        const siguienteInstruccion = this.bloque.siguienteElemento()
        
        if(siguienteInstruccion.estaResuelto()){
            this.bloque.pasarElemento()
            const proximaInstruccion = this.bloque.siguienteElemento()
            if(proximaInstruccion.estaResuelto()){
                if(!this.condicion.estaResuelto()){
                    this.condicion.resolver(hilo,estado)
                }else{
                    hilo.resolverSeguirCiclo(this.condicion, this)
                }
            }
           
        }else{
            
            siguienteInstruccion.resolver(hilo,estado)
        }
         

        
    }

}

export class While extends Instruccion{
    constructor(condicion, max){
        super()
        this.condicion = condicion
        this.max = max
    }
    
  
    resolver(hilo,estado){
        
        if(!this.condicion.estaResuelto()){
            this.condicion.resolver(hilo,estado)
        }else{
            this.resuelto = true
            this.condicion.reiniciar()
            hilo.resolverWhile(this.condicion,this.max,estado)
        }
    }

}

export class Else extends Instruccion{
    constructor(){
        super()
       
        
    }

    resolver(hilo,estado){
        this.resuelto = true
    }

    esElse(){
        return true
    }

    esInstruccionConBloque(){
        return true
    }
    
}


export class Sumar extends Instruccion{
    constructor(instruccion1 , instruccion2){
        super()
        
        this.instruccion1 = instruccion1
        this.instruccion2 = instruccion2
    }

    reiniciar(){
        super.reiniciar()
        this.instruccion1.reiniciar()
        this.instruccion2.reiniciar()
    }
    resolverPuro(hilo){
        return hilo.valorLocalDe("OP")
    }
    resolver(hilo,estado){
        
        if(!this.instruccion1.estaResuelto()){
            this.instruccion1.resolver(hilo,estado)
        }else if(!this.instruccion2.estaResuelto()){
            this.instruccion2.resolver(hilo,estado)
        }else{
            this.resuelto = true
            hilo.resolverConSuma(this.instruccion1,this.instruccion2 , estado)
        }
    }
}

export class ValorFijo extends Instruccion{
    constructor(valor){
        super()
        
        this.valor = valor
        
    }
    
   resolver(hilo,estado){
    
        this.resuelto = true
        hilo.resolverSegunValorFijo(this.valor,estado)
        
    }
    resolverPuro(hilo){
        return hilo.valorFijoSegun(this.valor)
    }
}

export class FinDeBloque extends Instruccion{
    constructor(){
        super()
    }
    resolver(hilo,estado){
        this.resuelto =  true
        hilo.resolverFinDeBloque(estado)
    }

    resolverPuro(hilo){

    }

    esFinDeBloque(){
        return true
    }

}



