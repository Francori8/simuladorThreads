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

    esInstruccionConBloque(){
        return false
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

    resolver(hilo,estado){
        if(!this.condicion.estaResuelto()){
            this.condicion.resolver(hilo,estado)
        }else{
            this.resuelto = true
            hilo.resolverCondicional(this.condicion,estado)
        }
    }

    aplicarValorDeVerdad(bool){
        this.valorDeVerdad = bool
    }


    esInstruccionConBloque(){
        return true
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
        return eval(this.valor)
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
