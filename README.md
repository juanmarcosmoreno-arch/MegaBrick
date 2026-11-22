<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo/megabrick-oscuro.webp" />
    <img src="public/logo/megabrick-claro.webp" alt="Megabrick" width="420" />
  </picture>
</p>

# Megabrick

**Megabrick** es un juego sandbox de bloques en primera persona que corre en el navegador. Recorrés un mundo hecho de cubos, lo explorás y construís bloque a bloque. Todo es original: el nombre, el diseño y las texturas, que se generan por código en pixel art de 16×16.

🎮 **Versión jugable:** https://juanmarcosmoreno-arch.github.io/MegaBrick/

> Megabrick se juega en **PC o Mac con teclado y mouse**. Por ahora no está pensado para celulares ni tablets.

## Estado del desarrollo

El juego se construye por etapas. Siempre queda una versión jugable.

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Base jugable: cámara en primera persona, vuelo, piso de bloques, atlas procedural, FPS | ✅ |
| 2 | Mundo por chunks y terreno procedural infinito | ✅ |
| 3 | Física del jugador: gravedad, salto, colisiones, nado | ✅ |
| 4 | Romper y poner bloques, hotbar, mira | ✅ |
| Extra | Multijugador: jugar en el mismo mundo desde otra computadora con un código | ✅ |
| 5 | Guardado en IndexedDB y menú de mundos | ✅ |
| 6 | Ciclo día/noche, oclusión ambiental, sonidos, opciones | ✅ |
| 7 | Rendimiento: Web Workers, cola de chunks priorizada | ✅ |
| 8 | Joystick (Xbox, PlayStation y otros): jugar y usar los menús | ✅ |
| 9 | Materiales de construcción: madera, piedra, ladrillo, revoque de colores, tejas, escalones, losas, puertas, ventanas y faroles; menú de materiales | ✅ |
| 10 | Animales: carpincho, oveja, gallina y conejo (acariciarlos, empujarlos, te siguen), también en el multijugador | ✅ |
| 11 | Resistencia de los materiales: romper tarda distinto según el bloque, con grietas | ✅ |
| 12 | Más bloques: naturaleza, pino y jacarandá, plantas y flores, hormigón, baldosa calcárea, metales, chapa, vidrios de colores, alfombras, cercos, rejas, paneles de vidrio, tranqueras, escaleras de mano y trampillas | ✅ |
| 13 | Mecanismos: cable de cobrizo, palanca, botón, placa de presión, lámpara, inversor, retardador, timbre y pistones; puertas, trampillas y tranqueras que se abren con energía | ✅ |
| 14 | Personajes para elegir: normal, soldado, vikingo, deportista, skater, gaucho, astronauta y bombero, con el color de la ropa | ✅ |
| 15 | Cuevas y carbón, luz de verdad (cuevas oscuras, antorchas) y modo aventura: mochila, juntar minerales, fabricar herramientas y bloques | ✅ |

## Requisitos

- [Node.js](https://nodejs.org/) 20.19 o más nuevo (recomendado: 22).
- Un navegador de escritorio con WebGL 2: Chrome, Edge, Firefox o Safari.

## Instalación

```bash
git clone https://github.com/juanmarcosmoreno-arch/MegaBrick.git
cd MegaBrick
npm install
```

## Cómo correrlo

```bash
npm run dev       # servidor de desarrollo con recarga automática
npm run build     # build de producción en la carpeta dist/
npm run preview   # sirve el build de producción para probarlo
```

`npm run dev` muestra en la consola la dirección para abrir el juego, por ejemplo `http://localhost:5173/megabrick/`.

### Opciones en la dirección

La semilla se elige al crear un mundo (**Nuevo mundo**) y el resto en **Opciones** (en la pausa). Para pruebas también se puede usar la dirección:

- `?distancia=8`: distancia de render en chunks, de 2 a 16, solo para esa vez (manda sobre la de Opciones).
- `?semilla=lo-que-quieras`: abre un mundo nuevo con esa semilla en vez del último mundo guardado. La misma semilla genera siempre el mismo terreno. Acepta texto o un número.

Ejemplo: `http://localhost:5173/megabrick/?semilla=islas&distancia=8`.

## Controles

| Tecla | Acción |
|---|---|
| Clic en **Jugar** o **Continuar** | Empezar a jugar o seguir el último mundo (captura el mouse) |
| Clic en **Continuar** o en cualquier parte (en pausa) | Volver al juego |
| **W A S D** | Moverse |
| **Mouse** | Mirar |
| **Espacio** | Saltar (mantenido, salta cada vez que toca el piso). En el agua: nadar hacia arriba |
| **Ctrl** (o doble toque de **W**) | Correr: más rápido y con la vista un poco más abierta |
| **F** | Activar o desactivar el vuelo (en el modo aventura no se vuela) |
| **Espacio / Shift** (volando) | Subir / bajar |
| **Clic izquierdo** | Romper el bloque apuntado: mantenelo apretado; cada material tarda distinto (ver Resistencia). Sobre un animal: empujarlo |
| **Clic derecho** | Poner el bloque elegido en la cara apuntada. Sobre un animal: acariciarlo |
| **1 – 9** o **rueda del mouse** | Elegir casilla de la hotbar |
| **E** | Creativo: menú de materiales (elegir qué bloque va en cada casilla). Aventura: la mochila y fabricar. E o Esc lo cierran |
| **V** | Cambiar la cámara: primera persona → tercera persona → de frente |
| **F3** | Mostrar u ocultar coordenadas, chunk, hacia dónde se mira, la hora, el tiempo por cuadro y más datos |
| **Esc** | Soltar el mouse y pausar (en la pausa: Opciones, Multijugador, Guardar y salir) |

### Joystick

También se juega con un joystick de Xbox, de PlayStation o cualquiera que el navegador reconozca con el mapeo estándar. No hace falta instalar nada: se conecta (por cable o Bluetooth), se aprieta un botón con el juego abierto y listo. La pantalla de inicio muestra entonces los botones del joystick (con los nombres de PlayStation si es uno de esos).

| Botón (Xbox / PlayStation) | Acción |
|---|---|
| **Palanca izquierda** | Moverse (inclinándola poco, más despacio). Apretarla: correr |
| **Palanca derecha** | Mirar |
| **A / ✕** | Saltar, nadar hacia arriba o subir volando |
| **B / ○** | Bajar volando |
| **Y / △** | Activar o desactivar el vuelo |
| **RT / R2** | Romper (mantenido, como el clic izquierdo) |
| **LT / L2** | Poner el bloque elegido |
| **LB RB / L1 R1** | Elegir casilla de la hotbar |
| **Vista / Create** | Menú de materiales o mochila (adentro, LB RB cambian de casilla, A pone el material, elige o fabrica, y B vuelve) |
| **X / □** | Cambiar la cámara |
| **Menú / Options** | Pausa (y en el inicio, Jugar) |

En los menús, la cruz (o la palanca izquierda) elige, **A** aprieta y **B** vuelve; en Opciones, izquierda y derecha cambian el valor. Con el joystick no se captura el mouse: si hacés clic, el juego pasa al mouse. La sensibilidad de Opciones vale para el mouse y para la palanca derecha.

Algunas cosas siguen pidiendo el teclado o el mouse: escribir (nombre de un mundo, semilla, nombre y código del multijugador), confirmar algo en un aviso del navegador y hacer sonar el juego la primera vez (el navegador deja sonar recién después de un clic o una tecla; un botón del joystick no cuenta).

### Física

- El jugador mide 1,8 bloques de alto y 0,6 de ancho, y choca contra los bloques. Su caja de colisión se mueve eje por eje y en pasos cortos, así que no atraviesa nada aunque caiga muy rápido.
- Hay gravedad. El salto alcanza unos 1,25 bloques: un escalón de un bloque se sube saltando y dos bloques ya no.
- En el agua te hundís despacio y nadás hacia arriba con Espacio. Para salir, nadá contra la orilla manteniendo Espacio. Con los ojos bajo el agua todo se ve azul.
- Volando no hay gravedad: Espacio sube y Shift baja.

> **Ctrl+W:** en el navegador, Ctrl+W cierra la pestaña y ninguna página puede impedirlo. Mientras jugás, Megabrick pide confirmación antes de cerrar. Si querés evitarlo del todo, corré con doble toque de W.

### Construir

- **Bloque apuntado:** la mira del centro marca el bloque al que apuntás, con un contorno, hasta 6 bloques de distancia. El cálculo es un raycast voxel con el algoritmo DDA, que no saltea ningún bloque. El agua se atraviesa con la mirada.
- **Romper y poner:** para romper un bloque hay que mantener apretado el clic izquierdo el tiempo que resiste su material; mientras tanto el bloque se va agrietando y suena un golpecito. Si soltás o apuntás a otro bloque, se empieza de nuevo. El lecho primordial es indestructible. Clic derecho pone el bloque elegido sobre la cara apuntada, pero nunca dentro del jugador; manteniendo el botón, se pone uno cada cuarto de segundo.
- **Resistencia:** cada material tarda distinto en romperse (los escalones y las losas, lo mismo que su material):

  | Tarda | Materiales |
  |---|---|
  | 0,15 – 0,3 s | Follaje, vidrio, ventana, paja |
  | 0,35 – 0,4 s | Césped, arena, tierra, farol |
  | 0,5 – 0,7 s | Puertas, biblioteca, tablones (claros, comunes, rojizos y oscuros), parqué, revoque |
  | 0,8 – 0,9 s | Tronco, arenisca, tejas, baldosas |
  | 1 – 1,2 s | Piedra, empedrado, ladrillos, piedra lisa, ladrillo de piedra |
  | 1,3 – 1,8 s | Mármol y los minerales (cobrizo, azurita y, la más dura, solarita) |
- **Hotbar:** tiene 9 casillas abajo de la pantalla. Un mundo nuevo empieza con césped, tierra, piedra, tablones, ladrillo de piedra, vidrio, tronco, follaje y arena. El bloque elegido se ve en la mano, en primera persona y también en el personaje en tercera persona.
- **Menú de materiales (E):** muestra todos los bloques para construir, en 12 grupos: naturaleza, plantas y flores, madera, piedra y ladrillo, metal y vidrio, revoque de colores, alfombras, techos, escalones y losas, cercos, rejas y escaleras, mecanismos, y puertas, ventanas y detalles. Si la ventana es chica, el borde de abajo se esfuma: hay más bajando. Arriba están las 9 casillas: elegís una y después el material que va en ella (también con las teclas 1 – 9). Lo que ponés en la hotbar se guarda con el mundo.
- **Escalones:** se ponen mirando hacia donde mirás, con la parte alta del lado de enfrente, así que para hacer una escalera o un techo a dos aguas alcanza con mirar hacia donde sube. Se suben caminando, sin saltar.
- **Losas:** medio bloque. Van abajo, salvo que apuntes a un techo o a la mitad de arriba de una pared: ahí van arriba. Una losa también se sube caminando (un bloque entero sigue pidiendo saltar).
- **Puertas:** ocupan dos bloques de alto y se ponen mirando hacia donde mirás, con la bisagra a tu izquierda. Clic derecho (o el gatillo izquierdo del joystick) las abre y las cierra; rotas, se va la puerta entera. Abiertas dejan pasar; cerradas, no.
- **Faroles:** brillan solos, igual de día que de noche, e iluminan lo de alrededor (ver [Luz](#luz)).
- **Antorchas:** se ponen en el piso o contra la pared apuntada (en el techo, no) y dan una luz cálida. Si sacás el bloque que la sostiene, se cae.
- **Cercos, rejas y paneles de vidrio:** se unen solos con el de al lado y con los bloques enteros (también el vidrio). Los cercos no se saltan ni se trepan desde el agua (tampoco los animales: sirven de corral).
- **Tranqueras y trampillas:** se ponen mirando hacia donde mirás y se abren y se cierran con clic derecho, como las puertas. La tranquera abierta deja pasar, y los cercos se unen a ella por sus extremos. La trampilla va abajo en su celda, o arriba (para tapar un hueco del piso) si apuntás a un techo o a la mitad de arriba de una cara; cerrada se pisa, y abierta deja pasar; con una escalera de mano abajo, se trepa (para salir de un pozo).
- **Escaleras de mano:** se ponen contra la pared apuntada. Para subir, avanzá o apretá Espacio; para bajar, Shift; si no tocás nada, te quedás agarrado.
- **Plantas y flores:** van sobre césped o tierra (el hongo, también sobre piedra), se atraviesan y salen con un toque. Si sacás el bloque de abajo, se caen; si ponés un bloque apuntándoles, lo reemplazan.
- **Alfombras y vidrios de colores:** las alfombras son una capa finita que se pisa; los vidrios dejan ver a través, teñido.
- **Formas:** las losas, los escalones y las puertas chocan, se apuntan y se marcan con su forma real (por el hueco de una losa se apunta lo de atrás).
- **Mallas:** al cambiar un bloque se rearma enseguida solo la malla de su chunk, y la del chunk vecino si el bloque está en el borde.
- **Agua:** si rompés un bloque con agua arriba o a un costado, el hueco se llena de agua. Por ahora el agua no fluye.
- **Tus cambios se recuerdan:** se guardan como diferencias respecto del terreno generado. Si te alejás y el chunk se descarga, al volver tu construcción sigue ahí. Ese registro es lo que se guarda en el navegador y lo que se comparte en el multijugador.
- **Mira:** en primera persona y en tercera desde atrás marca el bloque apuntado. En la vista de frente se oculta.

## Mecanismos

Con energía se arman puertas que se abren solas, luces, timbres, relojes y máquinas con pistones. La energía está prendida o apagada (no tiene niveles) y avanza de a pasos, 10 por segundo. Todo está en el grupo **Mecanismos** del menú (E).

- **Fuentes:** la **palanca** (clic derecho la prende o la apaga; va en el piso o en una pared), el **botón** (clic derecho lo aprieta y da energía un segundo; piso o pared), la **placa de presión** (da energía mientras alguien la pisa: el jugador o un animal) y el **bloque de solarita**, que da energía siempre.
- **Cable de cobrizo:** se pone sobre el piso y se une solo con los cables y mecanismos de al lado. Un tramo de cables unidos (hasta 4096) se prende entero, al instante, si alguno toca una fuente; prendido, brilla.
- **Lo que se enciende:** la **lámpara** se prende, el **timbre** suena al llegarle la energía, y las **puertas, trampillas y tranqueras** se abren cuando llega y se cierran cuando se va (mientras tanto se siguen usando a mano). Les llega la energía por cualquiera de sus lados.
- **Compuertas:** son losas finitas con una flecha que apunta hacia adelante (hacia donde mirabas al ponerlas): la entrada es atrás y la salida adelante, y solo dan energía hacia adelante. El **inversor** da energía cuando no le llega (un paso después: un inversor que se alimenta a sí mismo por un lazo de cable titila, y es un reloj) y el **retardador** la pasa igual pero 0,3 s después (sirve también para que la energía vaya en un solo sentido).
- **Pistón:** empuja hasta 12 bloques hacia donde mirabas al ponerlo (también para arriba o para abajo) cuando le llega energía, y se recoge cuando se va. El **pistón pegajoso** además trae de vuelta el bloque que tenía adelante. No mueve el lecho primordial, las puertas ni otros pistones estirados (dos pistones enfrentados se traban); lo que es frágil (plantas, cables, palancas) se rompe si lo empuja encima, y lo que estaba apoyado en un bloque que se mueve se cae.
- **Lo que se apoya:** cables, placas, compuertas, palancas y botones necesitan un bloque entero donde apoyarse; si se rompe ese bloque, se caen con él.
- **Siempre al día:** los circuitos se guardan con el mundo; al abrirlo, o al volver a un lugar que se había descargado, sus mecanismos se revisan solos (un reloj sigue titilando y un botón que quedó apretado se suelta). En pausa se frenan y siguen al volver.
- **Multijugador:** los circuitos los calcula el anfitrión y los cambios les llegan a todos como cualquier bloque; el invitado los usa igual (palancas, botones, placas). Como los animales, andan en la zona que el anfitrión tiene cargada: lejos de él esperan a que se acerque. Si el anfitrión se va, el que se queda con el mundo los sigue calculando.

## Guardado

Los mundos se guardan en el navegador (IndexedDB), en la misma computadora.

- **Inicio:** **Continuar** abre el último mundo jugado. La primera vez dice **Jugar** y crea «Mundo 1». **Nuevo mundo** pide un nombre y una semilla opcional; si la semilla queda vacía, sale una al azar. **Mis mundos** muestra la lista para abrir o borrar mundos. Borrar pide confirmación con un segundo clic.
- **Cuándo se guarda:** cada 30 segundos, al pausar, al cambiar de mundo, al ocultar la pestaña y con **Guardar y salir** (en la pausa), que además vuelve al inicio. En la pausa se ve si el mundo quedó guardado.
- **Qué se guarda:** el nombre, la semilla, dónde está el jugador (y si vuela), la hotbar, la hora del día y **solo los chunks que cambiaron**, como diferencias con el terreno generado. El resto se vuelve a generar igual con la semilla. Cada guardado escribe solo los chunks que cambiaron desde el anterior.
- **Con el multijugador:** el mundo de una partida lo guarda quien la creó, incluido lo que construyen los invitados. Quien entra como invitado no lo guarda: en su pausa el botón dice **Salir**, que lo saca de la partida y lo devuelve a su último mundo propio. Si en cambio sale con **Salir de la partida** (en el panel de Multijugador), o se va quien la creó, y sigue jugando, el mundo queda como propio, con el nombre «Mundo de Ana», por ejemplo («Mundo de Ana 2» si ya hay uno). Durante una partida no se puede cambiar de mundo.

**Límites.**
- Los mundos quedan en ese navegador y esa computadora. Si se borran los datos del sitio, se borran los mundos.
- Conviene abrir cada mundo en una sola pestaña a la vez: dos pestañas con el mismo mundo se pisan al guardar.
- Si el navegador no deja guardar (algunos modos privados), se puede jugar igual: la pausa lo avisa y el juego pregunta antes de cambiar de mundo. Si un guardado falla (por ejemplo, disco lleno), se avisa y se reintenta en el siguiente.

## Multijugador

Podés jugar en el mismo mundo con amigos, cada uno desde su computadora:

1. Una persona toca **Multijugador → Crear partida** y recibe un código, por ejemplo `K7Q-X2M`. Puede copiarlo y mandarlo por cualquier chat. El botón **Multijugador** está en la pantalla de inicio y también en la pausa: así se puede invitar a alguien a un mundo en el que ya se viene jugando.
2. Las demás tocan **Multijugador**, escriben el código en **Unirse** y entran a jugar. Reciben el mundo de quien creó la partida: misma semilla y mismos bloques cambiados. Aparecen al lado de quien la creó. Antes de cambiar de mundo, el propio se guarda.
3. Cada uno ve a los demás con su personaje, su color y su nombre arriba de la cabeza. Arriba a la derecha está la lista de jugadores. En la pausa están el código y el botón para copiarlo.
4. Lo que rompe o pone cualquiera aparece en las computadoras de todos, y todos ven los mismos animales.
5. **Salir de la partida** (en el panel de Multijugador) corta la conexión y deja seguir jugando solo en el mismo mundo. **Guardar y salir** (en la pausa) también deja la partida y vuelve al inicio; si lo hace quien la creó, la partida se cierra para todos (el juego pregunta antes). Cerrar el panel mientras se está conectando cancela la conexión.

**Cómo funciona.**
- **Conexión:** las computadoras se conectan directo entre sí con WebRTC. Para el primer contacto, que es intercambiar el código, se usa el servidor público y gratuito de [PeerJS](https://peerjs.com/), así que no hace falta un servidor propio y funciona desde GitHub Pages.
- **Qué viaja por la red:** el terreno no. Cada computadora lo genera con la semilla, y solo viajan las posiciones, los cambios de bloques, la hora (todos ven el mismo cielo) y los animales.
- **Los animales:** los mueve el anfitrión, también cerca de los invitados que andan por la zona que él tiene cargada (lejos de él no hay animales), y manda 5 veces por segundo dónde está y qué hace cada uno; los demás los mueven parejo de un dato al siguiente. Para acariciar o empujar un animal, el invitado se lo pide al anfitrión, que solo acepta animales cerca de quien los toca y unos pocos por segundo.
- **El anfitrión:** quien crea la partida ordena los cambios para que todos terminen viendo el mismo mundo. También revisa todo lo que mandan los demás, porque un jugador podría usar una versión modificada del juego. No acepta bloques inválidos, ni romper o poner lecho primordial, ni cambios lejos de donde está el jugador. Aplica como mucho 30 cambios por segundo por jugador (con ráfagas de hasta 60). Los que sobran esperan en fila y, si son demasiados, se rechazan y se le devuelve el bloque real a quien los hizo. Las posiciones de más de 30 por segundo se descartan. Los mensajes viajan en formato MsgPack, que no se puede usar para colgar la pestaña de otro con un mensaje armado a propósito.

**Límites.**
- La partida dura mientras quien la creó tenga el juego abierto. Si se va, los demás siguen jugando solos en ese mundo.
- Admite hasta 6 jugadores.
- En algunas redes muy cerradas, como empresas o colegios, la conexión directa puede fallar. PeerJS incluye servidores de respaldo (TURN) que ayudan en muchos casos.
- Para usar otro servidor de PeerJS, uno propio o uno local para probar con `npx peer --port 9000`, agregá `?servidor=host:puerto` a la dirección, en todas las computadoras. Sin protocolo se usa el de la página: desde GitHub Pages (https) el servidor tiene que tener https. Para uno local sin https, escribilo con el protocolo: `?servidor=http://localhost:9000`.

## El mundo

El mundo es infinito y se genera a medida que te movés, en chunks de 16 × 16 bloques de base y 128 de alto.

- **Terreno:** sale de ruido simplex con varias octavas, que arma llanuras, colinas y algunas montañas. Las cimas muy altas son de piedra.
- **Capas:** césped arriba, 3 o 4 de tierra, piedra debajo y lecho primordial indestructible en y = 0.
- **Agua:** el mar está a una altura fija (y = 40) y es semitransparente. Hay arena en costas y fondos poco profundos.
- **Árboles:** se agrupan en bosques y también aparecen sueltos. En las alturas son pinos, y en el llano a veces hay jacarandás en flor. Sus copas pasan de un chunk a otro sin cortarse.
- **Plantas:** pasto alto suelto, flores (margaritas, ceibos y flores celestes) por manchones, y en el bosque helechos y algún hongo. Las cumbres más altas tienen nieve.
- **Mundos de antes:** cada mundo recuerda con qué versión del generador se creó. Los guardados antes de la etapa 12 se siguen generando igual que siempre (solo con los árboles de antes, sin plantas ni nieve), así lo que construiste o sacaste queda como estaba; los nuevos traen todo lo nuevo.
- **Minerales:** carbón, cobrizo, azurita y solarita aparecen en vetas dentro de la piedra. El carbón es el más común; cuanto más raro el mineral, más hondo. La solarita brilla un poco en la oscuridad.
- **Cuevas:** túneles largos que serpentean (a veces salen a la superficie: son las entradas) y cavernas grandes en lo hondo, con los minerales a la vista en las paredes. Bajo el mar dejan un techo de piedra, así el agua nunca queda colgando sobre un hueco. Los mundos creados antes de la etapa 15 no tienen cuevas (se siguen generando igual).
- **Carga de chunks:** se generan y mallan en segundo plano (ver [Rendimiento](#rendimiento)), primero los más cercanos al jugador y los que tiene adelante. Los lejanos se liberan de la memoria.
- **Niebla:** tiene el color del horizonte (cambia con la hora) y tapa el borde del área cargada.

## Luz

Cada lugar del mundo tiene luz de 0 a 15, de dos clases:

- **Del cielo:** baja derecho por donde no hay techo y se desparrama, perdiendo un poco por bloque, así entra apenas en las cuevas y bajo los techos. Cuánto ilumina depende de la hora: de noche, la luz del cielo es la de la luna.
- **De los bloques:** antorchas (14), faroles y lámparas prendidas (15) y la solarita (6). Ilumina igual de día y de noche, con un tono cálido.

Las cuevas sin antorchas quedan casi negras. La luz se suaviza en cada esquina, como la oclusión. El bloque en la mano y los personajes toman la luz del lugar donde están. Se calcula al armar la malla de cada chunk, en los workers, mirando los 8 chunks de alrededor (una luz llega hasta 15 bloques); al poner o sacar algo que la cambia, se rearman también los vecinos.

## Modo aventura

Al crear un mundo se elige el modo: **Aventura** (el que viene marcado) o **Creativo**. Los mundos de antes de la etapa 15 son creativos.

- **Mochila (E):** 36 casillas; las 9 de abajo son la hotbar. Un clic en una casilla y otro en otra la mueve (si tienen lo mismo, se junta; si no, se intercambian). Con el mouse sobre una casilla, las teclas 1 a 9 la cambian por esa casilla de la hotbar. Entran hasta 64 de cada cosa por casilla (las herramientas, de a una).
- **Juntar:** lo que rompés va directo a la mochila. El césped da tierra, la piedra da empedrado y los minerales dan **carbón**, **cobrizo**, **azurita** y **solarita**. El follaje a veces suelta un palo; el pasto alto y los helechos no dan nada. Si la mochila está llena, avisa.
- **Herramientas:** picos, hachas y palas de madera, piedra, cobrizo y azurita. Cada una rompe más rápido lo suyo (el pico la piedra, el hacha la madera, la pala la tierra y la arena) y mejor cuanto mejor el material. La piedra a mano tarda muchísimo y no da nada: hace falta un pico. El carbón sale con uno de madera, el cobrizo pide uno de piedra y la azurita y la solarita, uno de cobrizo.
- **Fabricar:** en la mochila, a la derecha, están las recetas para las que tenés algo, primero las que alcanzan. Un clic fabrica una vez. Se fabrican desde la mochila, sin mesa de trabajo:

  | Da | Con |
  |---|---|
  | 4 tablones | 1 tronco (cada madera, los suyos) |
  | 4 palos | 2 tablones |
  | Pico o hacha | 3 tablones, empedrado, cobrizo o azurita + 2 palos |
  | Pala | 1 tablón, empedrado, cobrizo o azurita + 2 palos |
  | 4 antorchas | 1 carbón + 1 palo |
  | Farol | 1 solarita + 2 vidrios |
  | 2 vidrios | 2 arena + 1 carbón |
  | 4 ladrillos de piedra / 2 piedra lisa | 4 empedrado / 2 empedrado + 1 carbón |
  | Bloques de cobrizo, azurita y solarita | 9 del mineral (y de vuelta) |
  | Puerta, trampillas, cercos, tranquera, escalera de mano, ventana, biblioteca | Tablones, palos y vidrio |
  | Cable (8), palanca, botón, placa, lámpara, inversor, retardador, timbre, pistones | Cobrizo, empedrado, palos, solarita y vidrio |
  | Escalones (4) y losas (6) | 6 y 3 del material |

  El carbón hace de horno: con él se cocinan el vidrio, los ladrillos y la piedra lisa.
- **Poner:** cada bloque que ponés se gasta de la mochila. Con una herramienta o un mineral en la mano no se pone nada.
- **Sin vuelo:** en el modo aventura no se vuela. Tampoco hay vida ni hambre: nadie se lastima.
- **Se guarda:** el modo y la mochila se guardan con el mundo. En **Mis mundos** los de aventura dicen "Aventura".
- **Multijugador:** la partida tiene el modo del mundo del anfitrión; cada uno junta y fabrica en su propia mochila (la de un invitado empieza vacía y no se guarda). Cada uno ve lo que el otro tiene en la mano.

## Animales

En el pasto aparecen animales en grupos: **carpinchos** (tranquilos y nadadores; a veces con un benteveo en la cabeza), **ovejas** de lana esponjosa, **gallinas** y **conejos**. Cada especie tiene varias variantes de color.

- **Qué hacen:** pasean, pastan o picotean, se quedan mirando al jugador que está cerca, suben escalones de un bloque saltando (las paredes más altas no: se dan vuelta), no se tiran de los barrancos ni se suben a los árboles y, si caen al agua, flotan y nadan hasta la orilla. Al carpincho le gusta meterse al agua. Pasan por las puertas abiertas; las cerradas, los vidrios y las paredes no los atraviesan ni con el hocico.
- **Acariciar (clic derecho, o el gatillo izquierdo del joystick):** se pone contento, le salen corazones y te sigue un rato. Si acariciás a varios, te siguen en grupo sin encimarse.
- **Empujar (clic izquierdo, o el gatillo derecho):** da un respingo y sale corriendo para el otro lado. No se lastiman. Se los toca apuntando a cualquier parte del cuerpo; manteniendo el botón después de tocarlo no se rompe ni se pone nada (hay que soltarlo).
- **Sonidos:** cada especie tiene su voz, hecha con Web Audio como el resto de los sonidos; se escuchan más bajo cuanto más lejos están.
- **Dónde aparecen:** sobre el césped natural (no en el pasto que puso un jugador, como un techo), a 20–44 bloques del jugador y no adelante de él, hasta 10 cerca de cada jugador. Los que quedan lejos se van, pero no mientras alguien los está viendo. No se guardan con el mundo: cada vez aparecen otros.
- **F3** muestra cuántos animales hay.

## Ambiente

- **Día y noche:** un día dura 10 minutos. El cielo es un degradé del horizonte al cénit que cambia con la hora: celeste de día, naranja y rosado al amanecer y al atardecer (con un resplandor alrededor del sol) y azul muy oscuro de noche, con estrellas que giran con el cielo. El sol y la luna son de pixel art, dibujados por código. De noche baja la luz, pero se ve dónde se camina (hay luz de luna). La hora corre mientras se juega; en pausa se frena, salvo en una partida multijugador. Los mundos nuevos empiezan a media mañana.
- **Oclusión ambiental:** cada esquina de cada cara se oscurece según cuántos bloques la rodean, así los rincones, la base de las paredes y los huecos quedan en penumbra y se lee mejor el volumen.
- **Sonidos:** se generan con Web Audio, sin archivos. Hay pasos según lo que se pisa (pasto, tierra, piedra, madera, arena, hojas, vidrio), golpe al caer de alto, chapuzón y brazadas en el agua, y sonidos al romper y poner bloques. Cada vez suenan un poco distinto. En el multijugador también se oye lo que rompen o ponen los demás si están cerca. El sonido arranca con el primer clic o tecla (así lo exigen los navegadores).
- **Opciones** (en la pausa): distancia de render (2 a 16 chunks), sensibilidad del mouse, campo de visión (60° a 100°) y volumen. Se aplican al momento y se recuerdan en el navegador. **Valores de fábrica** vuelve a los de siempre.

## Rendimiento

La meta es 60 cuadros por segundo a distancia 8 en una PC o Mac común.

- **Web Workers:** la generación del terreno y el armado de las mallas corren en workers, fuera del hilo principal, así el juego no se traba mientras carga terreno. Se usan hasta 3, según los núcleos del procesador.
- **Cola de prioridad:** lo que falta se encarga de lo más cercano a lo más lejano, y antes lo que el jugador tiene adelante que lo que tiene a la espalda. Cada worker que termina toma el siguiente trabajo sin esperar al próximo cuadro, y las mallas listas también se suman en ese orden (si te das vuelta, se reordenan).
- **Tope por cuadro:** las mallas listas se suman a la escena de a pocas por cuadro (como máximo 6 y 3 ms), porque cada una se sube a la placa de video al dibujarla.
- **Cambios al instante:** el chunk que rompés o donde ponés un bloque se rearma en el mismo cuadro, en el hilo principal. Si un worker estaba armando una versión vieja de ese chunk, se descarta.
- **Memoria:** las mallas que quedan lejos se liberan (geometría incluida) y los datos de los chunks se descartan un poco más lejos. Al cambiar de mundo se descarta lo que todavía estaba en camino.
- **Sin workers:** si el navegador no los permite o fallan, el mundo se arma en el hilo principal con un tope de tiempo por cuadro. Es más lento, pero el juego sigue andando.
- **F3** muestra cuánto dura cada cuadro (el promedio y el más lento del último medio segundo: un cuadro lento es un tirón aunque los FPS den bien), cuántos trabajos tienen los workers y cuántas mallas listas esperan para sumarse a la escena. Los FPS se ven siempre, arriba a la izquierda.

## Personaje

Se elige en la pantalla de inicio, entre ocho personajes de bloques con cabeza grande: **Normal**, **Soldado**, **Vikingo**, **Deportista**, **Skater**, **Gaucho**, **Astronauta** y **Bombero**. Todos comparten el mismo muñeco (cabeza, cuerpo, brazos y piernas) y cada uno tiene su ropa, su cara y sus accesorios (cascos, sombrero, gorra, mochila...). Se arman por código: las texturas se pintan en pixel art en el momento, sin imágenes externas.

- **Color de la ropa:** violeta, verde, azul, rojo, amarillo o negro. Cambia la parte principal de la ropa de cada personaje (la remera, el uniforme, el poncho...), así se distinguen los jugadores en el multijugador. El personaje y el color quedan guardados en el navegador.
- **Expresiones:** normal, feliz, sorprendido y determinado, más parpadeo. En la pantalla de inicio las va mostrando una por una. En el juego se pone feliz cuando sube volando y pone cara de decidido mientras rompe bloques.
- **Animación:** respira, camina y corre moviendo brazos y piernas, vuela con los brazos abiertos, mira arriba y abajo con la cabeza y, al romper o poner, mueve el brazo derecho, donde lleva el bloque elegido.
- **Multijugador:** cada uno ve el personaje y el color de los demás, también si lo cambian durante la partida.
- **Cámara:** en primera persona no se ve. Con **V** pasa a tercera persona, desde atrás o de frente, y la cámara se acerca sola si atrás hay una pared.

## Estructura del código

```
index.html              → página: canvas, HUD y menús en HTML
vite.config.js          → configuración de Vite (ruta base para GitHub Pages)
public/
  logo/                 → logo de Megabrick (versión para fondo oscuro y para fondo claro)
  favicon.png           → ícono de la pestaña (emblema "M")
src/
  main.js               → arranque, estados del juego y loop principal
  style.css             → estilos del HUD y los menús
  world/
    blocks.js           → tipos de bloque, sus propiedades y formas (losas, escalones, puertas, plantas, cercos...)
    shapes.js           → formas que dependen de los vecinos: cercos, rejas, paneles y cables que se unen
    Circuits.js         → circuitos de energía: cables, fuentes, compuertas, lámparas, puertas y pistones
    Chunk.js            → datos de un chunk de 16×128×16 (Uint16Array, 0 = aire)
    World.js            → chunks alrededor del jugador (carga/descarga, cola de prioridad), get/set de bloques, mallas
    ChunkWorkers.js     → grupo de Web Workers: reparte los trabajos y avisa cuando terminan
    chunkWorker.js      → el worker: genera chunks y arma sus mallas
    collision.js        → choques de una caja contra los bloques (el jugador y los animales)
    Mesher.js           → una malla por chunk con solo las caras visibles, oclusión y luz por vértice (sin DOM: corre en los workers)
    TerrainGen.js       → terreno procedural con semilla: alturas, capas, agua, cuevas, árboles y minerales
    Light.js            → luz del cielo y de los bloques (0 a 15), con los 9 chunks de alrededor
  items/
    items.js            → objetos del modo aventura (minerales, palo, herramientas): qué da cada bloque y cuánto tarda
    recipes.js          → recetas para fabricar desde la mochila
    Backpack.js         → la mochila: 36 casillas con lo que se juntó
    itemIcons.js        → íconos de los objetos en pixel art, dibujados por código
  animals/
    Animals.js          → los animales del mundo: aparecen y se van, los corazones, la red
    Animal.js           → un animal: su cuerpo (choques, salto, nado) y lo que hace (pasear, pastar, escapar, seguir)
    species/            → cada especie: su modelo por código (carpincho, oveja, gallina, conejo) y en index.js cómo se comporta
  player/
    Player.js           → posición, orientación, física (colisiones AABB, salto, nado, vuelo)
    Controls.js         → teclado, mouse y pointer lock; jugar con el joystick sin capturar el mouse
    Gamepad.js          → joystick (Gamepad API): botones, palancas con zona muerta y nombres de los botones
    Raycast.js          → bloque apuntado con DDA
    Interaction.js      → romper y poner bloques
    Avatar.js           → el personaje en el juego: gira con la mirada, lleva el bloque en la mano
    characters/         → los personajes: humanoid.js (el muñeco, sus animaciones y caras), index.js (la lista) y uno por archivo
    colors.js           → los 6 colores de la ropa y las expresiones
    RemotePlayer.js     → otro jugador: su personaje, su nombre y movimiento suavizado
    ViewCamera.js       → cámara en primera y tercera persona (tecla V)
  render/
    atlasLayout.js      → ubicación de cada textura en el atlas (sin DOM, apto para workers)
    textures.js         → dibujo procedural del atlas (pixel art 16×16)
    materials.js        → materiales por capa (opaca, recortada, translúcida y la que brilla) y la luz en el shader
    Sky.js              → día y noche: cielo en degradé, sol, luna, estrellas, luces y niebla
    CharacterPreview.js → personaje girando en la pantalla de inicio
    BlockOutline.js     → contorno del bloque apuntado
    HeldItem.js         → bloque u objeto en la mano en primera persona
    itemMesh.js         → objetos planos en la mano (herramientas, minerales)
    blockGeometry.js    → geometría de un bloque suelto
    blockIcons.js       → íconos isométricos de los bloques (con su forma) para la hotbar y el menú
  ui/
    Hud.js              → mira, FPS, avisos y datos de F3
    Hotbar.js           → las 9 casillas de bloques (en aventura, las de la mochila con cuántos hay)
    Inventory.js        → menú de materiales (tecla E, creativo): todos los bloques por grupos
    BackpackMenu.js     → mochila del modo aventura (tecla E): mover casillas y fabricar
    Menu.js             → pantalla de inicio (con selector de color) y menú de pausa
    MultiplayerMenu.js  → panel de multijugador, lista de jugadores y datos en la pausa
    WorldsMenu.js       → Continuar/Jugar, nuevo mundo, lista de mundos (jugar y borrar) y estado del guardado
    OptionsMenu.js      → opciones: distancia de render, sensibilidad, campo de visión y volumen
    PadMenu.js          → menús con el joystick: mover el foco con la cruz, A aprieta, B vuelve
  audio/
    Sounds.js           → sonidos con Web Audio (pasos, romper, poner, agua) y pasos del jugador
  net/
    protocol.js         → códigos de partida, mensajes y validación de lo que llega por la red
    Session.js          → conexión WebRTC con PeerJS (anfitrión e invitados)
    Multiplayer.js      → estado de los jugadores y cambios de bloques compartidos
  save/
    Preferences.js      → preferencias del jugador (personaje, color de la ropa, nombre y opciones)
    SaveStore.js        → base IndexedDB: registro de cada mundo y sus chunks cambiados
    WorldSaves.js       → mundo actual, autoguardado, cargar, borrar y copias de partidas
```

### Bloques

| ID | Bloque | Notas |
|---|---|---|
| 0 | Aire | — |
| 1 | Césped | Superficie del terreno |
| 2 | Tierra | Debajo del césped |
| 3 | Piedra | Capa profunda |
| 4 | Lecho primordial | Roca base indestructible |
| 5 | Arena | Cerca del agua |
| 6 | Agua | Semitransparente |
| 7 | Tronco | Árboles |
| 8 | Follaje | Copa de los árboles, con huecos |
| 9 | Mineral de cobrizo | Veta naranja |
| 10 | Mineral de azurita | Veta azul |
| 11 | Mineral de solarita | Veta dorada, la más rara |
| 12 | Tablones | Para construir |
| 13 | Ladrillo de piedra | Para construir |
| 14 | Vidrio | Transparente, para construir |
| 15 – 21 | Tablones oscuros, sus 4 escalones y 2 losas | |
| 22 – 24 | Tablones claros, tablones rojizos, parqué | |
| 25 – 31 | Empedrado, escalones y losas | |
| 32 | Piedra lisa | |
| 33 – 39 | Ladrillos, escalones y losas | |
| 40 – 46 | Mármol, escalones y losas | |
| 47 – 53 | Arenisca, escalones y losas | |
| 54 | Baldosas | |
| 55 – 66 | Revoque blanco, crema, gris, negro, rojo, naranja, amarillo, verde, celeste, azul, violeta y rosa | |
| 67 – 80 | Tejas rojas y tejas grises, con escalones y losas | |
| 81 | Paja | |
| 82 – 113 | Puerta de madera y puerta oscura | 16 IDs cada una: 4 orientaciones, cerrada o abierta, mitad de abajo o de arriba |
| 114 – 116 | Ventana, farol, biblioteca | El farol brilla solo |
| 117 – 128 | Escalones y losas de tablones y de ladrillo de piedra | |
| 129 – 132 | Grava, arcilla, nieve, hielo | |
| 133 – 153 | Empedrado con musgo, granito y basalto, con escalones y losas | |
| 154 | Cactus | Un poco más angosto que un bloque |
| 155 – 172 | Pino y jacarandá: tronco, follaje y tablones (con escalones y losas) | |
| 173 – 178 | Pasto alto, helecho, margarita, flor de ceibo, flor celeste, hongo | Plantas: dos planos en X, se atraviesan |
| 179 – 187 | Hormigón (con escalones y losas), baldosa calcárea, venecitas | |
| 188 – 191 | Bloques de hierro, cobrizo, azurita y solarita | |
| 192 – 205 | Chapa y chapa oxidada, con escalones y losas | |
| 206 – 211 | Vidrio rojo, amarillo, verde, celeste, azul y violeta | Translúcidos |
| 212 – 215 | Cerco de madera, cerco oscuro, rejas, panel de vidrio | Un ID cada uno: se unen con los vecinos al dibujarlos |
| 216 – 223 | Tranquera | 8 IDs: 4 orientaciones, cerrada o abierta |
| 224 – 227 | Escalera de mano | Una por orientación |
| 228 – 243 | Trampilla | 16 IDs: 4 orientaciones, cerrada o abierta, abajo o arriba en su celda |
| 244 – 255 | Alfombras de los 12 colores del revoque | |
| 256 – 257 | Cable de cobrizo (apagado y prendido) | Plano, se une con los vecinos |
| 258 – 277 | Palanca y botón | 10 IDs cada uno: piso o 4 paredes, apagado o prendido |
| 278 – 281 | Placa de presión y lámpara (apagadas y prendidas) | |
| 282 – 297 | Inversor y retardador | 8 IDs cada uno: 4 orientaciones, salida apagada o prendida |
| 298 – 299 | Timbre | |
| 300 – 335 | Pistón y pistón pegajoso | 18 IDs cada uno: 6 direcciones, recogido o estirado, y la cabeza |
| 336 | Mineral de carbón | Vetas negras, el más común |
| 337 – 341 | Antorcha | En el piso o en cada pared |

Cada escalón usa 4 IDs (uno por orientación) y cada losa 2 (abajo y arriba): en la hotbar y en el menú se ve uno solo, y al ponerlo se elige el que corresponde. Los IDs se guardan en los mundos, así que los bloques nuevos se agregan siempre al final. Los chunks guardan IDs de 16 bits: hay lugar para 1024 tipos de bloque. Los objetos que no son bloques (minerales, palo y herramientas) usan IDs desde 1024 (ver `src/items/items.js`).

Para agregar un bloque se suma una línea en `src/world/blocks.js` (con `add`, o `addMaterial` si lleva escalones y losas) y, si necesita una textura nueva, su nombre en `src/render/atlasLayout.js` y su pintor en `src/render/textures.js` o en un archivo de `src/render/tiles/`. Las formas se describen con cajas (`boxes`): con ellas se dibuja, se choca y se apunta.

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` arma el build y lo publica en GitHub Pages con cada push a `main`. Se configura una sola vez, en el repositorio:

- **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- **Settings → General → Default branch: `main`**. El entorno `github-pages` que crea GitHub solo deja publicar desde la rama por defecto (se puede cambiar en **Settings → Environments → github-pages**).

También se puede publicar a mano desde **Actions → Deploy a GitHub Pages → Run workflow**.

La ruta base del build se toma del nombre del repositorio, porque GitHub Pages distingue mayúsculas en la ruta. Con el repositorio `MegaBrick`, la versión jugable está en `https://juanmarcosmoreno-arch.github.io/MegaBrick/`; si se renombra, el build se adapta solo.
