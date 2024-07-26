class Instruccion {
   
    proximaInstruccion(){
        return this.valor
    }
    estaResuelto(){
        return this.resuelto
    }
}

export class Imprimir extends Instruccion{
    constructor(valor, lugarAEscribir){
        super()
        this.resuelto = false
        this.valor = valor
        this.escritura = lugarAEscribir
    }

    resolver(hilo,estado){
        this.resuelto = true
        this.escritura.innerHTML += `<p>${this.valor}</p>`
        hilo.resolverConImprimir(this.valor, estado)
    }

    resolverPuro(hilo){
         
    }
}

export class Lectura extends Instruccion{
    constructor(valor){
        super()
        this.resuelto = false
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
        this.resuelto = false
        this.nombre = nombre
        this.valor = valor
    }

    resolver(hilo,estado){
        console.log(this)
        if(!this.valor.estaResuelto()){
            this.valor.resolver(hilo,estado)
        }else{
            this.resuelto = true
            hilo.resolverEscritura(this.nombre, this.valor , estado)
        }
    }
    
}

export class Operacion extends Instruccion{
    
}


export class Sumar extends Instruccion{
    constructor(instruccion1 , instruccion2){
        super()
        this.resuelto = false
        this.instruccion1 = instruccion1
        this.instruccion2 = instruccion2
    }
    resolverPuro(hilo){
        return hilo.valorLocalDe("OP")
    }
    resolver(hilo,estado){
        console.log(this)
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
        this.resuelto = false
        this.valor = valor
        
    }

   resolver(hilo,estado){
    console.log(this)
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
        hilo.resolverFinDeBloque(estado)
    }

    resolverPuro(hilo){

    }

}
