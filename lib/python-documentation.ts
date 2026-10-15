/**
 * Comprehensive Python Documentation & Type Inspection Engine for PyNodes.
 * Provides accurate Python 3 type representations (`type(x)`) and educational
 * documentation in Spanish for data types, built-in functions, operators,
 * control statements, and variables.
 */

export interface PythonBlockDoc {
  title: string
  rawCode: string
  blockType: 'codigo' | 'indentacion' | 'sticker' | 'rail'
  typeString: string // Exact Python type() representation, e.g. "<class 'int'>"
  typeCategory: string // e.g. "Tipo de Dato Numérico", "Función Incorporada", etc.
  categoryBadge: {
    bg: string
    badge: string
  }
  syntax?: string // Formal signature or syntax pattern
  description: string // Educational explanation in Spanish
  typeExplanation?: string // Why type(...) produces this
  properties?: Array<{ label: string; value: string }>
  example?: string // Python code example
  runtimeValue?: {
    value: string
    inferredType: string
    isLive: boolean
  }
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────

const BADGE_THEMES = {
  dataType: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badge: 'Tipo de Dato',
  },
  number: {
    bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    badge: 'Tipo Numérico',
  },
  builtin: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    badge: 'Función Incorporada',
  },
  operator: {
    bg: 'bg-pink-50 text-pink-700 border-pink-200',
    badge: 'Operador',
  },
  keyword: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    badge: 'Palabra Reservada',
  },
  variable: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    badge: 'Variable / Identificador',
  },
  delimiter: {
    bg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    badge: 'Delimitador de Sintaxis',
  },
  structure: {
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badge: 'Estructura de Bloque',
  },
  sticker: {
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    badge: 'Anotación / Sticker',
  },
}

// ─── Built-in Functions & Types Registry ──────────────────────────────────────

interface RegistryItem {
  name: string
  typeString: string
  category: keyof typeof BADGE_THEMES
  syntax: string
  description: string
  typeExplanation: string
  properties: Array<{ label: string; value: string }>
  example: string
}

const BUILTINS_REGISTRY: Record<string, RegistryItem> = {
  type: {
    name: 'type()',
    typeString: "<class 'type'>",
    category: 'builtin',
    syntax: 'type(object) -> class of object\ntype(name, bases, dict) -> new type',
    description:
      'Función incorporada de introspección que devuelve el tipo o clase a la que pertenece un objeto en tiempo de ejecución. Permite verificar la naturaleza de cualquier valor o variable.',
    typeExplanation:
      'Al aplicar type(type), Python indica que la función type es a su vez una instancia de la metaclase base <class \'type\'>.',
    properties: [
      { label: 'Tipo en Python', value: "<class 'type'>" },
      { label: 'Retorno', value: 'Clase o metatipo del objeto' },
      { label: 'Uso habitual', value: 'Introspección y verificación dinámica' },
    ],
    example: `x = 42\nprint(type(x))        # Salida: <class 'int'>\nprint(type("hola"))   # Salida: <class 'str'>\nprint(type(print))    # Salida: <class 'builtin_function_or_method'>`,
  },
  print: {
    name: 'print()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: "print(*objects, sep=' ', end='\\n', file=sys.stdout, flush=False)",
    description:
      'Imprime los objetos enviados como argumentos convirtiéndolos a texto (str), separados por "sep" y finalizando con la cadena "end" en la terminal o consola estándar.',
    typeExplanation:
      'print es una función C integrada en el intérprete de Python, por lo que su tipo es <class \'builtin_function_or_method\'>.',
    properties: [
      { label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" },
      { label: 'Retorno', value: 'None' },
      { label: 'Separador por defecto', value: "' ' (un espacio)" },
      { label: 'Fin de línea por defecto', value: "'\\n' (salto de línea)" },
    ],
    example: `print("Hola", "Mundo", sep=" - ")\n# Salida: Hola - Mundo\n\nprint("Cargando...", end="")`,
  },
  len: {
    name: 'len()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'len(s) -> int',
    description:
      'Devuelve el número de elementos de un contenedor, colección o secuencia (como cadenas de texto, listas, tuplas, diccionarios o conjuntos). Internamente invoca al método especial __len__().',
    typeExplanation:
      'len es una función nativa de Python con tipo <class \'builtin_function_or_method\'>.',
    properties: [
      { label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" },
      { label: 'Retorno', value: 'int (número entero >= 0)' },
      { label: 'Método especial', value: '__len__()' },
    ],
    example: `fruta = "manzana"\nprint(len(fruta))     # 7 caracteres\n\nlista = [1, 2, 3, 4]\nprint(len(lista))     # 4 elementos`,
  },
  input: {
    name: 'input()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'input([prompt]) -> str',
    description:
      'Muestra un mensaje opcional (prompt) y lee una línea ingresada por el usuario desde la entrada estándar (teclado), retornándola siempre como una cadena de texto (str).',
    typeExplanation:
      'input es una función nativa de I/O de Python con tipo <class \'builtin_function_or_method\'>.',
    properties: [
      { label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" },
      { label: 'Retorno', value: 'str (siempre retorna texto)' },
      { label: 'Conversión usual', value: 'int(input()) o float(input())' },
    ],
    example: `nombre = input("¿Cuál es tu nombre? ")\nedad = int(input("¿Cuántos años tienes? "))\nprint(f"Hola {nombre}, tienes {edad} años.")`,
  },
  range: {
    name: 'range()',
    typeString: "<class 'type'>",
    category: 'builtin',
    syntax: 'range(stop) -> range object\nrange(start, stop[, step]) -> range object',
    description:
      'Genera una secuencia inmutable de números enteros, comúnmente utilizada en bucles "for" para iterar un número determinado de veces sin consumir memoria por adelantado.',
    typeExplanation:
      'range es un tipo de secuencia inmutable en Python, no una función ordinaria, por lo que su tipo es <class \'type\'>.',
    properties: [
      { label: 'Tipo en Python', value: "<class 'type'>" },
      { label: 'Mutabilidad', value: 'Inmutable' },
      { label: 'Consumo de memoria', value: 'O(1) perezoso (lazy evaluation)' },
    ],
    example: `for i in range(3):\n    print(i)\n# Salida: 0, 1, 2\n\nlist(range(2, 10, 2))  # [2, 4, 6, 8]`,
  },
  int: {
    name: 'int()',
    typeString: "<class 'type'>",
    category: 'number',
    syntax: 'int(x=0) -> int\nint(x, base=10) -> int',
    description:
      'Constructor de la clase de números enteros. Convierte un número o cadena compatible en un valor entero. En Python 3 los enteros tienen precisión arbitraria ilimitada.',
    typeExplanation:
      'int es la clase de números enteros en Python (<class \'type\'>). Los valores literales como 42 son instancias de <class \'int\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'int'>" },
      { label: 'Mutabilidad', value: 'Inmutable' },
    ],
    example: `numero = int("45")\nprint(type(numero))   # <class 'int'>\nprint(numero + 5)     # 50`,
  },
  str: {
    name: 'str()',
    typeString: "<class 'type'>",
    category: 'dataType',
    syntax: 'str(object="") -> str',
    description:
      'Constructor de la clase de cadenas de texto (Unicode). Convierte cualquier objeto en su representación legible en texto. Las cadenas son secuencias inmutables.',
    typeExplanation:
      'str es la clase base para cadenas de texto (<class \'type\'>). Los literales entre comillas son instancias de <class \'str\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'str'>" },
      { label: 'Mutabilidad', value: 'Inmutable' },
      { label: 'Codificación', value: 'Unicode (UTF-8)' },
    ],
    example: `mensaje = "Python"\nprint(type(mensaje))    # <class 'str'>\nprint(mensaje.upper())  # 'PYTHON'`,
  },
  float: {
    name: 'float()',
    typeString: "<class 'type'>",
    category: 'number',
    syntax: 'float(x=0.0) -> float',
    description:
      'Constructor de números reales en coma flotante de doble precisión (estándar IEEE 754 de 64 bits). Soportan notación científica como 1e5.',
    typeExplanation:
      'float es la clase de números con punto decimal (<class \'type\'>). Un valor como 3.14 es de tipo <class \'float\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'float'>" },
      { label: 'Mutabilidad', value: 'Inmutable' },
    ],
    example: `pi = float("3.14159")\nprint(type(pi))   # <class 'float'>`,
  },
  bool: {
    name: 'bool()',
    typeString: "<class 'type'>",
    category: 'dataType',
    syntax: 'bool(x=False) -> bool',
    description:
      'Constructor de valores booleanos de verdad. Subclase de int que solo puede tomar True (1) o False (0). Valores vacíos como "", 0, [], None se evalúan a False.',
    typeExplanation:
      'bool es una clase derivada de int (<class \'type\'>). True y False son de tipo <class \'bool\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'bool'>" },
      { label: 'Valores posibles', value: 'True o False' },
    ],
    example: `activo = True\nprint(type(activo))     # <class 'bool'>\nprint(bool(0))          # False\nprint(bool("hola"))     # True`,
  },
  list: {
    name: 'list()',
    typeString: "<class 'type'>",
    category: 'dataType',
    syntax: 'list([iterable]) -> new list',
    description:
      'Constructor de listas en Python. Crea secuencias ordenadas y mutables que pueden contener elementos heterogéneos y modificarse mediante append, pop, etc.',
    typeExplanation:
      'list es la clase de listas (<class \'type\'>). Los literales como [1, 2, 3] son de tipo <class \'list\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'list'>" },
      { label: 'Mutabilidad', value: 'Mutable (modificable)' },
    ],
    example: `elementos = [10, "texto", True]\nprint(type(elementos))  # <class 'list'>\nelementos.append(99)`,
  },
  dict: {
    name: 'dict()',
    typeString: "<class 'type'>",
    category: 'dataType',
    syntax: 'dict(**kwargs) | dict(mapping, **kwargs)',
    description:
      'Constructor de diccionarios. Colección mutable de pares clave: valor donde las claves deben ser objetos inmutables con hash (como str, int, tuple).',
    typeExplanation:
      'dict es la clase de diccionarios (<class \'type\'>). Los literales {"a": 1} son de tipo <class \'dict\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'dict'>" },
      { label: 'Mutabilidad', value: 'Mutable' },
      { label: 'Acceso por clave', value: 'O(1) en promedio' },
    ],
    example: `usuario = {"id": 1, "nombre": "Ada"}\nprint(type(usuario))      # <class 'dict'>\nprint(usuario["nombre"])  # Ada`,
  },
  tuple: {
    name: 'tuple()',
    typeString: "<class 'type'>",
    category: 'dataType',
    syntax: 'tuple([iterable]) -> new tuple',
    description:
      'Constructor de tuplas. Secuencias inmutables y ordenadas de elementos. Se definen comúnmente con paréntesis (1, 2) o separando valores con comas.',
    typeExplanation:
      'tuple es la clase de tuplas (<class \'type\'>). Una tupla como (1, 2) es de tipo <class \'tuple\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'tuple'>" },
      { label: 'Mutabilidad', value: 'Inmutable' },
    ],
    example: `punto = (10, 20)\nprint(type(punto))  # <class 'tuple'>`,
  },
  set: {
    name: 'set()',
    typeString: "<class 'type'>",
    category: 'dataType',
    syntax: 'set([iterable]) -> new set',
    description:
      'Constructor de conjuntos. Colección mutable y desordenada de elementos únicos sin duplicados. Soporta operaciones matemáticas de unión, intersección y diferencia.',
    typeExplanation:
      'set es la clase de conjuntos (<class \'type\'>). Literales como {1, 2, 3} son de tipo <class \'set\'>.',
    properties: [
      { label: 'Tipo de la clase', value: "<class 'type'>" },
      { label: 'Tipo de una instancia', value: "<class 'set'>" },
      { label: 'Elementos repetidos', value: 'Se descartan automáticamente' },
    ],
    example: `unicos = {1, 2, 2, 3}\nprint(type(unicos))  # <class 'set'>\nprint(unicos)        # {1, 2, 3}`,
  },
  sum: {
    name: 'sum()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'sum(iterable, /, start=0) -> number',
    description:
      'Suma los elementos de un objeto iterable de izquierda a derecha y devuelve el total acumulado más el valor inicial start.',
    typeExplanation: 'sum es una función C integrada con tipo <class \'builtin_function_or_method\'>.',
    properties: [
      { label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" },
      { label: 'Retorno', value: 'int o float' },
    ],
    example: `notas = [8, 9, 10]\nprint(sum(notas))  # 27`,
  },
  min: {
    name: 'min()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'min(iterable, *[, default=obj, key=func]) -> value',
    description: 'Devuelve el elemento con el menor valor de un iterable o de dos o más argumentos.',
    typeExplanation: 'min es una función nativa con tipo <class \'builtin_function_or_method\'>.',
    properties: [{ label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" }],
    example: `print(min(5, 2, 9))      # 2\nprint(min([10, 4, 30]))  # 4`,
  },
  max: {
    name: 'max()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'max(iterable, *[, default=obj, key=func]) -> value',
    description: 'Devuelve el elemento con el mayor valor de un iterable o de dos o más argumentos.',
    typeExplanation: 'max es una función nativa con tipo <class \'builtin_function_or_method\'>.',
    properties: [{ label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" }],
    example: `print(max(5, 2, 9))      # 9\nprint(max([10, 4, 30]))  # 30`,
  },
  abs: {
    name: 'abs()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'abs(x) -> number',
    description:
      'Devuelve el valor absoluto o magnitud de un número. Invoca internamente a __abs__().',
    typeExplanation: 'abs es una función nativa con tipo <class \'builtin_function_or_method\'>.',
    properties: [
      { label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" },
      { label: 'Método especial', value: '__abs__()' },
    ],
    example: `print(abs(-15))  # 15\nprint(abs(3.14)) # 3.14`,
  },
  round: {
    name: 'round()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'round(number, ndigits=None) -> number',
    description:
      'Redondea un número a un número determinado de decimales ndigits. Aplica redondeo al par más cercano (bankers rounding).',
    typeExplanation: 'round es una función nativa con tipo <class \'builtin_function_or_method\'>.',
    properties: [{ label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" }],
    example: `print(round(3.14159, 2))  # 3.14\nprint(round(2.5))          # 2`,
  },
  isinstance: {
    name: 'isinstance()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'isinstance(object, classinfo) -> bool',
    description:
      'Verifica si un objeto es una instancia o subclase de una clase dada o de una tupla de clases.',
    typeExplanation:
      'isinstance es una función de introspección con tipo <class \'builtin_function_or_method\'>.',
    properties: [{ label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" }],
    example: `x = "hola"\nprint(isinstance(x, str))        # True\nprint(isinstance(x, (int, float))) # False`,
  },
  sorted: {
    name: 'sorted()',
    typeString: "<class 'builtin_function_or_method'>",
    category: 'builtin',
    syntax: 'sorted(iterable, /, *, key=None, reverse=False) -> list',
    description:
      'Devuelve una nueva lista con los elementos del iterable ordenados ascendentemente (o descendentemente con reverse=True).',
    typeExplanation: 'sorted es una función nativa con tipo <class \'builtin_function_or_method\'>.',
    properties: [{ label: 'Tipo en Python', value: "<class 'builtin_function_or_method'>" }],
    example: `nums = [3, 1, 4, 1, 5]\nprint(sorted(nums))  # [1, 1, 3, 4, 5]`,
  },
}

// ─── Python Operators Registry ────────────────────────────────────────────────

interface OperatorItem {
  symbol: string
  name: string
  category: string
  syntax: string
  description: string
  dunder: string
  typeString: string
  example: string
}

const OPERATORS_REGISTRY: Record<string, OperatorItem> = {
  '+': {
    symbol: '+',
    name: 'Suma / Concatenación',
    category: 'Operador Aritmético y Secuencial',
    syntax: 'a + b',
    description:
      'Calcula la suma numérica entre dos números (int, float) o realiza la concatenación cuando se aplica sobre secuencias del mismo tipo como cadenas (str) o listas (list).',
    dunder: '__add__(self, other)',
    typeString: "<operator 'aritmético / concatenación'>",
    example: `# Suma numérica:\nresultado = 10 + 5    # 15\n\n# Concatenación de texto:\nsaludo = "Hola " + "Ada"  # "Hola Ada"`,
  },
  '-': {
    symbol: '-',
    name: 'Resta / Negación',
    category: 'Operador Aritmético',
    syntax: 'a - b   (o unario: -a)',
    description:
      'Calcula la resta numérica entre dos operandos o niega el signo de un operando como operador unario negativo.',
    dunder: '__sub__(self, other)',
    typeString: "<operator 'aritmético / resta'>",
    example: `x = 20 - 7   # 13\ny = -x       # -13`,
  },
  '*': {
    symbol: '*',
    name: 'Multiplicación / Repetición',
    category: 'Operador Aritmético y Secuencial',
    syntax: 'a * b',
    description:
      'Multiplica dos valores numéricos. Si se aplica sobre una secuencia (str, list, tuple) y un entero n, repite dicha secuencia n veces.',
    dunder: '__mul__(self, other)',
    typeString: "<operator 'aritmético / repetición'>",
    example: `producto = 4 * 5      # 20\nlinea = "-" * 10      # "----------"`,
  },
  '/': {
    symbol: '/',
    name: 'División de punto flotante',
    category: 'Operador Aritmético',
    syntax: 'a / b',
    description:
      'Realiza la división real entre dos números. En Python 3 siempre devuelve un resultado de tipo float, incluso si la división es exacta.',
    dunder: '__truediv__(self, other)',
    typeString: "<operator 'aritmético / división'>",
    example: `resultado = 7 / 2     # 3.5  (float)\nexacto = 10 / 2       # 5.0  (float)`,
  },
  '//': {
    symbol: '//',
    name: 'División entera (Floor Division)',
    category: 'Operador Aritmético',
    syntax: 'a // b',
    description:
      'Calcula el cociente entero de la división, redondeando hacia abajo (suelo matemático) al entero inferior más cercano.',
    dunder: '__floordiv__(self, other)',
    typeString: "<operator 'aritmético / división entera'>",
    example: `cociente = 7 // 2    # 3 (int)\nprint(type(cociente)) # <class 'int'>`,
  },
  '%': {
    symbol: '%',
    name: 'Módulo (Resto de la división)',
    category: 'Operador Aritmético',
    syntax: 'a % b',
    description:
      'Devuelve el residuo o resto obtenido al dividir el operando a entre el operando b. Se usa frecuentemente para verificar si un número es par o impar (n % 2 == 0).',
    dunder: '__mod__(self, other)',
    typeString: "<operator 'aritmético / módulo'>",
    example: `resto = 10 % 3        # 1\nes_par = (4 % 2 == 0) # True`,
  },
  '**': {
    symbol: '**',
    name: 'Potenciación (Exponente)',
    category: 'Operador Aritmético',
    syntax: 'a ** b',
    description: 'Eleva la base a al exponente b (equivalente a pow(a, b)).',
    dunder: '__pow__(self, other)',
    typeString: "<operator 'aritmético / potencia'>",
    example: `cuadrado = 5 ** 2     # 25\ncubo = 2 ** 3         # 8`,
  },
  '=': {
    symbol: '=',
    name: 'Asignación básica',
    category: 'Operador de Asignación',
    syntax: 'variable = expresion',
    description:
      'Asocia un nombre de variable con el objeto o resultado de la expresión evaluada en la memoria de Python.',
    dunder: 'N/A (Sintaxis del núcleo)',
    typeString: "<operator 'asignación'>",
    example: `edad = 25\nmensaje = "Hola"`,
  },
  '+=': {
    symbol: '+=',
    name: 'Suma con asignación en sitio',
    category: 'Operador de Asignación Aumentada',
    syntax: 'a += b  (equivalente a: a = a + b)',
    description:
      'Suma el valor derecho a la variable izquierda y reasigna el resultado directamente. En listas mutables realiza una extensión in-place mediante __iadd__().',
    dunder: '__iadd__(self, other)',
    typeString: "<operator 'asignación aumentada'>",
    example: `puntos = 10\npuntos += 5   # puntos ahora es 15`,
  },
  '-=': {
    symbol: '-=',
    name: 'Resta con asignación',
    category: 'Operador de Asignación Aumentada',
    syntax: 'a -= b',
    description: 'Resta el operando derecho a la variable y guarda el resultado.',
    dunder: '__isub__(self, other)',
    typeString: "<operator 'asignación aumentada'>",
    example: `vidas = 3\nvidas -= 1    # vidas ahora es 2`,
  },
  '*=': {
    symbol: '*=',
    name: 'Multiplicación con asignación',
    category: 'Operador de Asignación Aumentada',
    syntax: 'a *= b',
    description: 'Multiplica la variable por el valor derecho y actualiza su valor.',
    dunder: '__imul__(self, other)',
    typeString: "<operator 'asignación aumentada'>",
    example: `total = 5\ntotal *= 2    # 10`,
  },
  '/=': {
    symbol: '/=',
    name: 'División con asignación',
    category: 'Operador de Asignación Aumentada',
    syntax: 'a /= b',
    description: 'Divide la variable y actualiza su valor a un número flotante.',
    dunder: '__itruediv__(self, other)',
    typeString: "<operator 'asignación aumentada'>",
    example: `precio = 100\nprecio /= 2   # 50.0`,
  },
  '==': {
    symbol: '==',
    name: 'Comparación de igualdad',
    category: 'Operador de Comparación Relacional',
    syntax: 'a == b -> bool',
    description:
      'Compara si el valor o contenido de a es igual al de b. Devuelve True si son equivalentes o False en caso contrario. Invoca al método __eq__().',
    dunder: '__eq__(self, other)',
    typeString: "<operator 'comparación de igualdad'>",
    example: `print(5 == 5)       # True\nprint("a" == "b")   # False`,
  },
  '!=': {
    symbol: '!=',
    name: 'Comparación de desigualdad',
    category: 'Operador de Comparación Relacional',
    syntax: 'a != b -> bool',
    description:
      'Compara si el valor de a es diferente al de b. Invoca internamente al método especial __ne__().',
    dunder: '__ne__(self, other)',
    typeString: "<operator 'comparación de desigualdad'>",
    example: `print(10 != 20)     # True\nprint(5 != 5)       # False`,
  },
  '<': {
    symbol: '<',
    name: 'Menor que',
    category: 'Operador de Comparación Relacional',
    syntax: 'a < b -> bool',
    description: 'Devuelve True si a es estrictamente menor que b.',
    dunder: '__lt__(self, other)',
    typeString: "<operator 'comparación menor que'>",
    example: `print(3 < 10)       # True`,
  },
  '<=': {
    symbol: '<=',
    name: 'Menor o igual que',
    category: 'Operador de Comparación Relacional',
    syntax: 'a <= b -> bool',
    description: 'Devuelve True si a es menor o igual que b.',
    dunder: '__le__(self, other)',
    typeString: "<operator 'comparación menor o igual'>",
    example: `print(5 <= 5)       # True`,
  },
  '>': {
    symbol: '>',
    name: 'Mayor que',
    category: 'Operador de Comparación Relacional',
    syntax: 'a > b -> bool',
    description: 'Devuelve True si a es estrictamente mayor que b.',
    dunder: '__gt__(self, other)',
    typeString: "<operator 'comparación mayor que'>",
    example: `print(15 > 8)       # True`,
  },
  '>=': {
    symbol: '>=',
    name: 'Mayor o igual que',
    category: 'Operador de Comparación Relacional',
    syntax: 'a >= b -> bool',
    description: 'Devuelve True si a es mayor o igual que b.',
    dunder: '__ge__(self, other)',
    typeString: "<operator 'comparación mayor o igual'>",
    example: `print(10 >= 10)     # True`,
  },
  and: {
    symbol: 'and',
    name: 'Operador lógico Y (AND)',
    category: 'Operador Lógico Booleano',
    syntax: 'a and b',
    description:
      'Evalúa con cortocircuito: si a es falso, devuelve a sin evaluar b; si a es verdadero, evalúa y devuelve b.',
    dunder: 'N/A (Control de flujo con cortocircuito)',
    typeString: "<operator 'lógico Y'>",
    example: `x = 5\nif x > 0 and x < 10:\n    print("x está entre 0 y 10")`,
  },
  or: {
    symbol: 'or',
    name: 'Operador lógico O (OR)',
    category: 'Operador Lógico Booleano',
    syntax: 'a or b',
    description:
      'Evalúa con cortocircuito: si a es verdadero, lo devuelve de inmediato; si es falso, evalúa y devuelve b.',
    dunder: 'N/A (Control de flujo con cortocircuito)',
    typeString: "<operator 'lógico O'>",
    example: `color = "rojo"\nif color == "rojo" or color == "azul":\n    print("Color primario")`,
  },
  not: {
    symbol: 'not',
    name: 'Operador lógico NO (NOT)',
    category: 'Operador Lógico Booleano',
    syntax: 'not a -> bool',
    description:
      'Invierte el valor de verdad booleano de la expresión. Si la expresión es verdadera devuelve False; si es falsa devuelve True.',
    dunder: 'N/A',
    typeString: "<operator 'lógico NO'>",
    example: `activo = False\nprint(not activo)   # True`,
  },
  in: {
    symbol: 'in',
    name: 'Operador de pertenencia',
    category: 'Operador de Pertenencia Secuencial',
    syntax: 'elemento in coleccion -> bool',
    description:
      'Verifica si un elemento se encuentra dentro de una secuencia o colección (str, list, tuple, set, dict). Invoca al método __contains__().',
    dunder: '__contains__(self, item)',
    typeString: "<operator 'pertenencia'>",
    example: `vocales = "aeiou"\nprint("e" in vocales)        # True\n\nfrutas = ["pera", "manzana"]\nprint("kiwi" in frutas)      # False`,
  },
  is: {
    symbol: 'is',
    name: 'Operador de identidad de objetos',
    category: 'Operador de Identidad en Memoria',
    syntax: 'a is b -> bool',
    description:
      'Compara si dos referencias apuntan exactamente al mismo objeto en memoria (id(a) == id(b)). Se usa comúnmente para comprobar None (x is None).',
    dunder: 'N/A (Compara punteros id(x))',
    typeString: "<operator 'identidad'>",
    example: `x = None\nif x is None:\n    print("x no tiene valor")`,
  },
}

// ─── Python Keywords Registry ─────────────────────────────────────────────────

interface KeywordItem {
  keyword: string
  name: string
  category: string
  syntax: string
  description: string
  typeString: string
  example: string
}

const KEYWORDS_REGISTRY: Record<string, KeywordItem> = {
  if: {
    keyword: 'if',
    name: 'Sentencia condicional IF',
    category: 'Control de Flujo Condicional',
    syntax: 'if condicion:\n    bloque_de_codigo',
    description:
      'Evalúa una condición booleana. Si resulta verdadera (True), ejecuta el bloque de código subordinado con 4 espacios de indentación.',
    typeString: "<keyword 'control-flow'>",
    example: `edad = 18\nif edad >= 18:\n    print("Mayor de edad")`,
  },
  elif: {
    keyword: 'elif',
    name: 'Condición alternativa ELIF',
    category: 'Control de Flujo Condicional',
    syntax: 'elif otra_condicion:\n    bloque_de_codigo',
    description:
      'Abreviatura de "else if". Se evalúa únicamente si las condiciones de los if o elif anteriores resultaron falsas.',
    typeString: "<keyword 'control-flow'>",
    example: `calif = 85\nif calif >= 90:\n    print("A")\nelif calif >= 80:\n    print("B")`,
  },
  else: {
    keyword: 'else',
    name: 'Rama por defecto ELSE',
    category: 'Control de Flujo Condicional y Bucles',
    syntax: 'else:\n    bloque_por_defecto',
    description:
      'Ejecuta su bloque subordinado cuando ninguna de las condiciones if / elif previas se cumplió. En bucles for/while se ejecuta al finalizar sin interrupciones por break.',
    typeString: "<keyword 'control-flow'>",
    example: `if x > 0:\n    print("Positivo")\nelse:\n    print("Cero o negativo")`,
  },
  for: {
    keyword: 'for',
    name: 'Bucle de iteración FOR',
    category: 'Bucle / Iteración',
    syntax: 'for variable in iterable:\n    bloque_de_codigo',
    description:
      'Itera secuencialmente sobre cada uno de los elementos de cualquier objeto iterable (como listas, tuplas, rangos o cadenas).',
    typeString: "<keyword 'iteration'>",
    example: `for i in range(3):\n    print("Paso", i)`,
  },
  while: {
    keyword: 'while',
    name: 'Bucle condicional WHILE',
    category: 'Bucle / Iteración',
    syntax: 'while condicion:\n    bloque_de_codigo',
    description:
      'Repite la ejecución de su bloque de código mientras la condición booleana continúe siendo verdadera (True).',
    typeString: "<keyword 'iteration'>",
    example: `contador = 0\nwhile contador < 3:\n    print(contador)\n    contador += 1`,
  },
  def: {
    keyword: 'def',
    name: 'Declaración de función DEF',
    category: 'Declaración de Subrutina / Función',
    syntax: 'def nombre_funcion(parametros):\n    return resultado',
    description:
      'Define una nueva función personalizada en Python, encapsulando lógica reutilizable con nombre propio y parámetros.',
    typeString: "<keyword 'declaration'>",
    example: `def saludar(nombre):\n    return f"Hola {nombre}!"\n\nprint(saludar("Mundo"))`,
  },
  return: {
    keyword: 'return',
    name: 'Sentencia RETURN',
    category: 'Control de Flujo de Funciones',
    syntax: 'return [expresion]',
    description:
      'Finaliza inmediatamente la ejecución de la función y devuelve el valor de la expresión especificada al punto donde fue llamada. Si no se especifica valor, devuelve None.',
    typeString: "<keyword 'control-flow'>",
    example: `def cuadrado(n):\n    return n * n\n\nres = cuadrado(4)  # 16`,
  },
  class: {
    keyword: 'class',
    name: 'Definición de CLASE',
    category: 'Programación Orientada a Objetos',
    syntax: 'class NombreClase:\n    def __init__(self):\n        pass',
    description:
      'Crea una nueva clase (molde o plantilla) para instanciar objetos con atributos y métodos propios en Python.',
    typeString: "<keyword 'declaration'>",
    example: `class Perro:\n    def ladrar(self):\n        return "Guau!"`,
  },
  import: {
    keyword: 'import',
    name: 'Importación de módulos IMPORT',
    category: 'Módulos y Paquetes',
    syntax: 'import nombre_modulo\nimport modulo as alias',
    description:
      'Carga un módulo de la biblioteca estándar o de terceros en el espacio de nombres actual para utilizar sus funciones y clases.',
    typeString: "<keyword 'module'>",
    example: `import math\nprint(math.sqrt(16))  # 4.0`,
  },
  from: {
    keyword: 'from',
    name: 'Importación selectiva FROM',
    category: 'Módulos y Paquetes',
    syntax: 'from modulo import elemento',
    description:
      'Importa elementos específicos (funciones, clases, constantes) directamente de un módulo sin necesidad de prefijar el nombre del módulo.',
    typeString: "<keyword 'module'>",
    example: `from math import pi, sqrt\nprint(sqrt(25))  # 5.0`,
  },
  try: {
    keyword: 'try',
    name: 'Manejo de excepciones TRY',
    category: 'Gestión de Errores',
    syntax: 'try:\n    codigo_propicio_a_error\nexcept TipoError:\n    recuperacion',
    description:
      'Envuelve un bloque de código potencialmente susceptible a errores en tiempo de ejecución para capturar y controlar las excepciones sin detener el programa.',
    typeString: "<keyword 'exception'>",
    example: `try:\n    num = int("abc")\nexcept ValueError:\n    print("No es un número válido")`,
  },
  except: {
    keyword: 'except',
    name: 'Captura de errores EXCEPT',
    category: 'Gestión de Errores',
    syntax: 'except TipoError as error:\n    manejador',
    description:
      'Captura la excepción generada dentro de un bloque try y ejecuta el bloque de manejo alternativo correspondiente.',
    typeString: "<keyword 'exception'>",
    example: `except ZeroDivisionError:\n    print("No se puede dividir entre cero")`,
  },
  break: {
    keyword: 'break',
    name: 'Interrupción BREAK',
    category: 'Control de Flujo de Bucles',
    syntax: 'break',
    description:
      'Interrumpe y finaliza inmediatamente la ejecución del bucle for o while más interno que lo contenga.',
    typeString: "<keyword 'control-flow'>",
    example: `for i in range(10):\n    if i == 5:\n        break\n    print(i)`,
  },
  continue: {
    keyword: 'continue',
    name: 'Siguiente iteración CONTINUE',
    category: 'Control de Flujo de Bucles',
    syntax: 'continue',
    description:
      'Omite el resto del código de la iteración actual del bucle y salta directamente a la siguiente iteración.',
    typeString: "<keyword 'control-flow'>",
    example: `for i in range(5):\n    if i == 2:\n        continue\n    print(i)  # Imprime 0, 1, 3, 4`,
  },
  pass: {
    keyword: 'pass',
    name: 'Operación nula PASS',
    category: 'Marcador de Posición Sintáctico',
    syntax: 'pass',
    description:
      'Instrucción vacía que no realiza ninguna acción. Se usa como marcador de posición donde la sintaxis de Python exige un bloque indentado pero aún no se ha escrito código.',
    typeString: "<keyword 'placeholder'>",
    example: `def funcion_por_implementar():\n    pass`,
  },
}

// ─── Delimiters & Punctuation Registry ────────────────────────────────────────

const DELIMITERS_REGISTRY: Record<
  string,
  { name: string; description: string; syntax: string; example: string }
> = {
  ':': {
    name: 'Dos puntos (Inicio de bloque)',
    description:
      'En Python, los dos puntos (:) indican el final de la cabecera de una estructura de control (if, for, while, def, class, with) y señalan que a continuación comienza un bloque subordinado e indentado.',
    syntax: 'estructura_control:\n    bloque_indentado',
    example: 'if x > 0:\n    print("Mayor")',
  },
  '(': {
    name: 'Paréntesis de apertura',
    description:
      'Se utilizan para invocar funciones pasando argumentos, para definir tuplas ordenadas (x, y) y para agrupar expresiones matemáticas alterando la precedencia.',
    syntax: 'funcion(arg1, arg2) | (elem1, elem2)',
    example: 'resultado = (3 + 5) * 2\nprint("Hola")',
  },
  ')': {
    name: 'Paréntesis de cierre',
    description: 'Cierra una llamada a función, tupla o agrupación de expresión.',
    syntax: '...)',
    example: 'print("Fin")',
  },
  '[': {
    name: 'Corchete de apertura',
    description:
      'Se utiliza para definir listas literales mutables [1, 2, 3], acceder a elementos por índice (lista[0]) o realizar cortes (slicing: lista[1:3]).',
    syntax: '[elem1, elem2] | coleccion[indice]',
    example: 'frutas = ["manzana", "pera"]\nprimer_elem = frutas[0]',
  },
  ']': {
    name: 'Corchete de cierre',
    description: 'Cierra una lista o una operación de indexación/slicing.',
    syntax: '...]',
    example: 'lista[0]',
  },
  '{': {
    name: 'Llave de apertura',
    description:
      'Se utiliza para definir diccionarios con pares clave: valor {"a": 1} o conjuntos de elementos únicos {1, 2, 3}.',
    syntax: '{"clave": valor} | {elem1, elem2}',
    example: 'info = {"nombre": "Ana", "edad": 20}',
  },
  '}': {
    name: 'Llave de cierre',
    description: 'Cierra un diccionario o conjunto literal.',
    syntax: '...}',
    example: 'datos = {"a": 1}',
  },
  ',': {
    name: 'Coma separadora',
    description:
      'Separa elementos dentro de listas, tuplas, conjuntos, diccionarios y argumentos en llamadas a funciones.',
    syntax: 'a, b, c',
    example: 'def sumar(a, b):\n    return a + b',
  },
  '.': {
    name: 'Punto de acceso a miembros',
    description:
      'Permite acceder a atributos o métodos de un objeto o módulo (ej: objeto.metodo() o math.pi).',
    syntax: 'objeto.atributo | objeto.metodo()',
    example: 'texto = "hola"\nprint(texto.upper())  # HOLA',
  },
  '->': {
    name: 'Anotación de retorno de función',
    description:
      'En las firmas de funciones def nombre() -> tipo:, indica el tipo de dato que la función debe retornar según las pistas de tipo (Type Hints, PEP 484).',
    syntax: 'def nombre() -> tipo_retorno:',
    example: 'def sumar(a: int, b: int) -> int:\n    return a + b',
  },
}

// ─── Main Inspector Function ──────────────────────────────────────────────────

export interface InspectContext {
  canvasCode?: string
  currentScope?: Record<string, string>
}

/**
 * Inspects any code block, token, indentation, or sticker in PyNodes
 * and generates a complete educational documentation card matching
 * Python's `type(...)` output and semantics.
 */
export function inspectPythonBlock(
  block: {
    id?: string
    tipo?: string
    code?: string
    contenido?: string | null
    data?: Record<string, unknown>
  },
  context: InspectContext = {}
): PythonBlockDoc {
  const blockType = (block.tipo ||
    (block.data?.rows ? 'indentacion' : block.data?.variant ? 'sticker' : 'codigo')) as
    | 'codigo'
    | 'indentacion'
    | 'sticker'
    | 'rail'

  // ─── 1. Indentation Block ────────────────────────────────────────────────────
  if (blockType === 'indentacion') {
    return {
      title: 'Indentación (4 espacios)',
      rawCode: '    ',
      blockType: 'indentacion',
      typeString: "<indentation 'scope'>",
      typeCategory: 'Estructura de Bloque y Alcance',
      categoryBadge: BADGE_THEMES.structure,
      syntax: '4 espacios por nivel de anidación (PEP 8)',
      description:
        'En Python la indentación es sintáctica: define qué instrucciones pertenecen al cuerpo de una función, bucle o condicional. A diferencia de C, Java o JavaScript que usan llaves {}, Python utiliza 4 espacios consistentes.',
      typeExplanation:
        'La indentación es una regla estructural del analizador léxico de Python (tokens INDENT y DEDENT). No es un objeto en memoria, sino la base de los bloques de código.',
      properties: [
        { label: 'Convención estándar', value: 'PEP 8 (4 espacios)' },
        { label: 'Tokens léxicos', value: 'INDENT y DEDENT' },
        { label: 'Propósito', value: 'Delimitar bloques subordinados y alcance (scope)' },
      ],
      example: `if puntuacion > 50:\n    # Bloque subordinado con 4 espacios de indentación:\n    print("¡Aprobado!")\n    nivel += 1`,
    }
  }

  // ─── 2. Sticker Node ────────────────────────────────────────────────────────
  if (blockType === 'sticker') {
    const rawContent = block.contenido || block.data?.text || block.data?.emoji || 'Sticker'
    return {
      title: `Anotación: ${rawContent}`,
      rawCode: String(rawContent),
      blockType: 'sticker',
      typeString: "<annotation 'canvas-tag'>",
      typeCategory: 'Anotación del Lienzo',
      categoryBadge: BADGE_THEMES.sticker,
      description:
        'Elemento decorativo y pedagógico en el lienzo de PyNodes para clasificar, resaltar o categorizar bloques de código y conceptos del problema.',
      properties: [
        { label: 'Tipo en PyNodes', value: 'Sticker / Etiqueta didáctica' },
        { label: 'Interactividad', value: 'Se puede arrastrar y posicionar libremente' },
      ],
      example: `# Usa los stickers para organizar visualmente tus bloques de código en el lienzo.`,
    }
  }

  // ─── 3. Code Block ──────────────────────────────────────────────────────────
  const raw = String(block.code ?? block.contenido ?? '').trim()

  // 3.1 Check Delimiters & Punctuation
  if (DELIMITERS_REGISTRY[raw]) {
    const d = DELIMITERS_REGISTRY[raw]
    return {
      title: d.name,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<delimiter 'syntax'>",
      typeCategory: 'Delimitador de Sintaxis',
      categoryBadge: BADGE_THEMES.delimiter,
      syntax: d.syntax,
      description: d.description,
      typeExplanation:
        'Los delimitadores y caracteres de puntuación son símbolos léxicos reservados que estructuran las expresiones y llamadas en Python.',
      properties: [
        { label: 'Categoría sintáctica', value: 'Delimitador de código' },
        { label: 'Rol', value: 'Organización sintáctica de la gramática de Python' },
      ],
      example: d.example,
    }
  }

  // 3.2 Check Operators
  if (OPERATORS_REGISTRY[raw]) {
    const op = OPERATORS_REGISTRY[raw]
    return {
      title: `${op.symbol} (${op.name})`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: op.typeString,
      typeCategory: op.category,
      categoryBadge: BADGE_THEMES.operator,
      syntax: op.syntax,
      description: op.description,
      typeExplanation: `En Python, el operador "${op.symbol}" se traduce a nivel de objetos en la invocación del método especial "${op.dunder}".`,
      properties: [
        { label: 'Tipo en Python', value: op.typeString },
        { label: 'Método especial (Dunder)', value: op.dunder },
        { label: 'Asociatividad', value: 'De izquierda a derecha' },
      ],
      example: op.example,
    }
  }

  // 3.3 Check Keywords
  if (KEYWORDS_REGISTRY[raw]) {
    const kw = KEYWORDS_REGISTRY[raw]
    return {
      title: `${kw.keyword} (${kw.name})`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: kw.typeString,
      typeCategory: kw.category,
      categoryBadge: BADGE_THEMES.keyword,
      syntax: kw.syntax,
      description: kw.description,
      typeExplanation: `"${kw.keyword}" es una palabra reservada del lenguaje que forma parte de la gramática formal de Python y no puede usarse como nombre de variable.`,
      properties: [
        { label: 'Tipo en Python', value: kw.typeString },
        { label: 'Reservada', value: 'Sí (no se puede reasignar)' },
      ],
      example: kw.example,
    }
  }

  // 3.4 Check Built-in Functions & Types
  if (BUILTINS_REGISTRY[raw]) {
    const bi = BUILTINS_REGISTRY[raw]
    return {
      title: bi.name,
      rawCode: raw,
      blockType: 'codigo',
      typeString: bi.typeString,
      typeCategory:
        bi.category === 'builtin'
          ? 'Función Incorporada (Built-in)'
          : bi.category === 'number'
          ? 'Tipo Numérico'
          : 'Tipo de Dato',
      categoryBadge: BADGE_THEMES[bi.category] || BADGE_THEMES.builtin,
      syntax: bi.syntax,
      description: bi.description,
      typeExplanation: bi.typeExplanation,
      properties: bi.properties,
      example: bi.example,
    }
  }

  // 3.5 Check Literals: Booleans & None
  if (raw === 'True' || raw === 'False') {
    return {
      title: `${raw} (Valor booleano)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<class 'bool'>",
      typeCategory: 'Tipo de Dato Booleano',
      categoryBadge: BADGE_THEMES.dataType,
      syntax: 'bool -> True | False',
      description: `Literal booleano ${raw}. Representa el estado lógico ${
        raw === 'True' ? 'verdadero' : 'falso'
      } en Python. Subclase de int donde True tiene valor aritmético 1 y False 0.`,
      typeExplanation:
        'Al aplicar type(' + raw + ') en Python, el intérprete devuelve <class \'bool\'>.',
      properties: [
        { label: 'Tipo en Python', value: "<class 'bool'>" },
        { label: 'Mutabilidad', value: 'Inmutable' },
        { label: 'Equivalente entero', value: raw === 'True' ? '1' : '0' },
      ],
      example: `activo = ${raw}\nprint(type(activo))  # <class 'bool'>\nif activo:\n    print("Activo")`,
    }
  }

  if (raw === 'None') {
    return {
      title: 'None (Valor Nulo)',
      rawCode: 'None',
      blockType: 'codigo',
      typeString: "<class 'NoneType'>",
      typeCategory: 'Objeto Especial Nulo',
      categoryBadge: BADGE_THEMES.dataType,
      syntax: 'None',
      description:
        'Objeto singleton que representa la ausencia explícita de valor o el valor nulo en Python. Las funciones que no tienen una sentencia return retornan None por defecto.',
      typeExplanation:
        'Al aplicar type(None), Python devuelve <class \'NoneType\'>.',
      properties: [
        { label: 'Tipo en Python', value: "<class 'NoneType'>" },
        { label: 'Instancias', value: 'Singleton único' },
      ],
      example: `resultado = None\nprint(type(resultado))  # <class 'NoneType'>\nif resultado is None:\n    print("Sin valor asignado")`,
    }
  }

  // 3.6 Check String Literals
  if (
    /^[fFrRbBuU]{0,2}("""[\s\S]*"""|'''[\s\S]*'''|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')$/.test(
      raw
    ) ||
    (/^["'].*["']$/.test(raw) && raw.length >= 2)
  ) {
    const isFormatted = /^[fF]/.test(raw)
    return {
      title: `${raw} (Cadena de texto)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<class 'str'>",
      typeCategory: isFormatted
        ? 'Cadena Formateada (f-string)'
        : 'Tipo de Dato: Cadena de texto (String)',
      categoryBadge: BADGE_THEMES.dataType,
      syntax: 'str: "texto" | \'texto\' | f"valor: {var}"',
      description:
        'Secuencia inmutable de caracteres Unicode. Soporta indexación, corte (slicing) y una rica variedad de métodos integrados como .upper(), .lower(), .replace(), .strip() y .split().',
      typeExplanation:
        `Al evaluar type(${raw}) en Python, el resultado es siempre <class 'str'>, indicando que es una instancia de la clase de cadenas.`,
      properties: [
        { label: 'Tipo en Python', value: "<class 'str'>" },
        { label: 'Mutabilidad', value: 'Inmutable' },
        { label: 'Longitud', value: `${raw.replace(/^f?["']|["']$/g, '').length} caracteres` },
        { label: 'Codificación', value: 'Unicode (UTF-8)' },
      ],
      example: `mensaje = ${raw}\nprint(type(mensaje))    # <class 'str'>\nprint(len(mensaje))\nprint(mensaje.upper())`,
    }
  }

  // 3.7 Check Integer Literals
  if (/^-?(?:0|[1-9]\d*|0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+)$/.test(raw)) {
    return {
      title: `${raw} (Número Entero)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<class 'int'>",
      typeCategory: 'Tipo de Dato Numérico: Entero (int)',
      categoryBadge: BADGE_THEMES.number,
      syntax: 'int: 0, 1, 42, -15, 0xFF',
      description:
        'Número entero con precisión ilimitada en Python 3. Soporta operaciones aritméticas exactas de suma (+), resta (-), multiplicación (*), división entera (//), módulo (%) y potencia (**).',
      typeExplanation:
        `Al evaluar type(${raw}) en Python, el intérprete devuelve <class 'int'>.`,
      properties: [
        { label: 'Tipo en Python', value: "<class 'int'>" },
        { label: 'Mutabilidad', value: 'Inmutable' },
        { label: 'Precisión', value: 'Arbitraria (ilimitada en Python 3)' },
      ],
      example: `numero = ${raw}\nprint(type(numero))     # <class 'int'>\nprint(numero + 10)`,
    }
  }

  // 3.8 Check Float Literals
  if (/^-?(?:\d+\.\d*|\.\d+|\d+[eE][+-]?\d+|\d+\.\d*[eE][+-]?\d*)$/.test(raw)) {
    return {
      title: `${raw} (Número Flotante)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<class 'float'>",
      typeCategory: 'Tipo de Dato Numérico: Punto Flotante (float)',
      categoryBadge: BADGE_THEMES.number,
      syntax: 'float: 3.14, -0.5, 1e-4',
      description:
        'Número real en coma flotante de doble precisión (IEEE 754 de 64 bits). Soportan operaciones aritméticas decimales y científicas.',
      typeExplanation:
        `Al evaluar type(${raw}) en Python, el intérprete devuelve <class 'float'>.`,
      properties: [
        { label: 'Tipo en Python', value: "<class 'float'>" },
        { label: 'Mutabilidad', value: 'Inmutable' },
        { label: 'Estándar', value: 'IEEE 754 (64 bits)' },
      ],
      example: `pi = ${raw}\nprint(type(pi))         # <class 'float'>\nprint(round(pi, 2))`,
    }
  }

  // 3.9 Check List Literals: [1, 2, 3] or []
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return {
      title: `${raw} (Lista)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<class 'list'>",
      typeCategory: 'Estructura de Datos: Lista (list)',
      categoryBadge: BADGE_THEMES.dataType,
      syntax: '[elemento1, elemento2, ...]',
      description:
        'Secuencia mutable y ordenada de elementos en Python. Puede contener elementos de cualquier tipo y modificarse con append, extend, insert o pop.',
      typeExplanation:
        `Al evaluar type(${raw}) en Python, el resultado es <class 'list'>.`,
      properties: [
        { label: 'Tipo en Python', value: "<class 'list'>" },
        { label: 'Mutabilidad', value: 'Mutable' },
      ],
      example: `mi_lista = ${raw}\nprint(type(mi_lista))   # <class 'list'>\nprint(len(mi_lista))`,
    }
  }

  // 3.10 Check Dict Literals: {"a": 1} or {}
  if (raw.startsWith('{') && raw.endsWith('}') && raw.includes(':')) {
    return {
      title: `${raw} (Diccionario)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<class 'dict'>",
      typeCategory: 'Estructura de Datos: Diccionario (dict)',
      categoryBadge: BADGE_THEMES.dataType,
      syntax: '{clave: valor, ...}',
      description:
        'Estructura de datos basada en tabla hash que mapea claves únicas e inmutables con sus respectivos valores.',
      typeExplanation:
        `Al evaluar type(${raw}) en Python, el resultado es <class 'dict'>.`,
      properties: [
        { label: 'Tipo en Python', value: "<class 'dict'>" },
        { label: 'Mutabilidad', value: 'Mutable' },
      ],
      example: `datos = ${raw}\nprint(type(datos))      # <class 'dict'>`,
    }
  }

  // 3.11 Check Identifier / Variable (e.g. x, total, nombre)
  if (/^[a-zA-Z_]\w*$/.test(raw)) {
    // Check if there is an active runtime scope in context
    const scopeVal = context.currentScope?.[raw]
    let liveType = ''
    let isLive = false

    if (scopeVal !== undefined && scopeVal !== null) {
      isLive = true
      // Inferred type based on evaluated string
      if (scopeVal === 'True' || scopeVal === 'False') liveType = "<class 'bool'>"
      else if (scopeVal === 'None') liveType = "<class 'NoneType'>"
      else if (!isNaN(Number(scopeVal))) {
        liveType = Number.isInteger(Number(scopeVal)) ? "<class 'int'>" : "<class 'float'>"
      } else if (
        (scopeVal.startsWith('"') && scopeVal.endsWith('"')) ||
        (scopeVal.startsWith("'") && scopeVal.endsWith("'"))
      ) {
        liveType = "<class 'str'>"
      } else if (scopeVal.startsWith('[') && scopeVal.endsWith(']')) {
        liveType = "<class 'list'>"
      } else if (scopeVal.startsWith('{') && scopeVal.endsWith('}')) {
        liveType = "<class 'dict'>"
      } else {
        liveType = "<class 'str'>"
      }
    }

    const typeStr = isLive ? liveType : "<class 'identifier'>"

    return {
      title: `${raw} (Variable / Identificador)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: typeStr,
      typeCategory: 'Variable / Identificador',
      categoryBadge: BADGE_THEMES.variable,
      syntax: `${raw} = valor`,
      description:
        `Identificador simbólico "${raw}". En Python, las variables no tienen tipo estático predefinido; funcionan como referencias o etiquetas que apuntan a objetos en memoria. El tipo de "${raw}" lo determina dinámicamente el objeto al que está asignado.`,
      typeExplanation: isLive
        ? `En el estado actual de ejecución en el lienzo, "${raw}" tiene el valor ${scopeVal}, por lo que type(${raw}) devuelve ${liveType}.`
        : `Al ejecutar type(${raw}) en Python, devolverá la clase del objeto actualmente asignado a la variable (por ejemplo <class 'int'>, <class 'str'>, etc.).`,
      properties: [
        { label: 'Nombre del identificador', value: raw },
        {
          label: 'Tipado en Python',
          value: 'Dinámico y fuerte (Duck Typing)',
        },
        ...(isLive
          ? [
              { label: 'Valor actual en lienzo', value: String(scopeVal) },
              { label: 'type(variable) actual', value: liveType },
            ]
          : []),
      ],
      runtimeValue: isLive
        ? {
            value: String(scopeVal),
            inferredType: liveType,
            isLive: true,
          }
        : undefined,
      example: `${raw} = 10\nprint(type(${raw}))  # <class 'int'>\n\n${raw} = "Ahora soy texto"\nprint(type(${raw}))  # <class 'str'>`,
    }
  }

  // 3.12 Compound Code Block (e.g. "x = 10", "print('hola')", "def suma(a, b):")
  // Check if it's an assignment: a = b
  if (raw.includes('=') && !raw.includes('==') && !raw.includes('!=') && !raw.includes('<=') && !raw.includes('>=')) {
    const parts = raw.split('=')
    const varName = parts[0].trim()
    const valExpr = parts.slice(1).join('=').trim()

    return {
      title: `${raw} (Sentencia de Asignación)`,
      rawCode: raw,
      blockType: 'codigo',
      typeString: "<statement 'assignment'>",
      typeCategory: 'Sentencia de Asignación de Variable',
      categoryBadge: BADGE_THEMES.variable,
      syntax: 'variable = expresion',
      description:
        `Sentencia de asignación: evalúa la expresión "${valExpr}" y asocia el resultado con el identificador "${varName}". En Python la variable apunta a la referencia del objeto creado.`,
      typeExplanation:
        `Las sentencias de asignación no devuelven un valor como expresión por sí mismas; crean o reasignan la variable ${varName}. Al consultar type(${varName}) después de la asignación, se obtendrá la clase del valor asignado.`,
      properties: [
        { label: 'Variable destino', value: varName },
        { label: 'Expresión evaluada', value: valExpr },
      ],
      example: `# Al ejecutarse este bloque:\n${raw}\nprint(type(${varName}))`,
    }
  }

  // Fallback for general expressions or blocks
  return {
    title: raw,
    rawCode: raw,
    blockType: 'codigo',
    typeString: "<expression 'python-code'>",
    typeCategory: 'Expresión / Bloque de Código',
    categoryBadge: BADGE_THEMES.dataType,
    syntax: raw,
    description:
      `Bloque de código de Python: "${raw}". En PyNodes puedes interconectar este bloque en la secuencia adecuada para resolver el desafío.`,
    typeExplanation:
      'Al evaluar esta expresión en el intérprete, type(...) devolverá la clase del objeto resultante.',
    properties: [
      { label: 'Código', value: raw },
      { label: 'Tipo', value: 'Expresión ejecutable' },
    ],
    example: `# Código del bloque:\n${raw}`,
  }
}
