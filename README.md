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
| **F** | Activar o desactivar el vuelo |
| **Espacio / Shift** (volando) | Subir / bajar |
| **Clic izquierdo** | Romper el bloque apuntado (mantenido, sigue rompiendo). Sobre un animal: empujarlo |
| **Clic derecho** | Poner el bloque elegido en la cara apuntada. Sobre un animal: acariciarlo |
| **1 – 9** o **rueda del mouse** | Elegir casilla de la hotbar |
| **E** | Menú de materiales: elegir qué bloque va en cada casilla (E o Esc lo cierran) |
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
| **RT / R2** | Romper (mantenido, sigue rompiendo) |
| **LT / L2** | Poner el bloque elegido |
| **LB RB / L1 R1** | Elegir casilla de la hotbar |
| **Vista / Create** | Menú de materiales (adentro, LB RB cambian de casilla, A pone el material y B vuelve) |
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
- **Romper y poner:** clic izquierdo rompe el bloque, salvo el lecho primordial, que es indestructible. Clic derecho pone el bloque elegido sobre la cara apuntada, pero nunca dentro del jugador. Manteniendo el botón, se repite cada cuarto de segundo.
- **Hotbar:** tiene 9 casillas abajo de la pantalla. Un mundo nuevo empieza con césped, tierra, piedra, tablones, ladrillo de piedra, vidrio, tronco, follaje y arena. El bloque elegido se ve en la mano, en primera persona y también en el personaje en tercera persona.
- **Menú de materiales (E):** muestra todos los bloques para construir, en 7 grupos: naturaleza, madera, piedra y ladrillo, revoque de colores, techos, escalones y losas, y puertas, ventanas y detalles. Arriba están las 9 casillas: elegís una y después el material que va en ella (también con las teclas 1 – 9). Lo que ponés en la hotbar se guarda con el mundo.
- **Escalones:** se ponen mirando hacia donde mirás, con la parte alta del lado de enfrente, así que para hacer una escalera o un techo a dos aguas alcanza con mirar hacia donde sube. Se suben caminando, sin saltar.
- **Losas:** medio bloque. Van abajo, salvo que apuntes a un techo o a la mitad de arriba de una pared: ahí van arriba. Una losa también se sube caminando (un bloque entero sigue pidiendo saltar).
- **Puertas:** ocupan dos bloques de alto y se ponen mirando hacia donde mirás, con la bisagra a tu izquierda. Clic derecho (o el gatillo izquierdo del joystick) las abre y las cierra; rotas, se va la puerta entera. Abiertas dejan pasar; cerradas, no.
- **Faroles:** brillan solos, igual de día que de noche (no iluminan lo de alrededor).
- **Formas:** las losas, los escalones y las puertas chocan, se apuntan y se marcan con su forma real (por el hueco de una losa se apunta lo de atrás).
- **Mallas:** al cambiar un bloque se rearma enseguida solo la malla de su chunk, y la del chunk vecino si el bloque está en el borde.
- **Agua:** si rompés un bloque con agua arriba o a un costado, el hueco se llena de agua. Por ahora el agua no fluye.
- **Tus cambios se recuerdan:** se guardan como diferencias respecto del terreno generado. Si te alejás y el chunk se descarga, al volver tu construcción sigue ahí. Ese registro es lo que se guarda en el navegador y lo que se comparte en el multijugador.
- **Mira:** en primera persona y en tercera desde atrás marca el bloque apuntado. En la vista de frente se oculta.

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
- **Los animales:** los mueve el anfitrión, también cerca de los invitados, y manda 5 veces por segundo dónde está y qué hace cada uno; los demás los mueven suave hacia ahí. Para acariciar o empujar un animal, el invitado se lo pide al anfitrión, que solo acepta animales cerca de quien los toca y unos pocos por segundo.
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
- **Árboles:** se agrupan en bosques y también aparecen sueltos. Sus copas pasan de un chunk a otro sin cortarse.
- **Minerales:** cobrizo, azurita y solarita aparecen en vetas dentro de la piedra. Cuanto más raro el mineral, más hondo.
- **Carga de chunks:** se generan y mallan en segundo plano (ver [Rendimiento](#rendimiento)), primero los más cercanos al jugador y los que tiene adelante. Los lejanos se liberan de la memoria.
- **Niebla:** tiene el color del horizonte (cambia con la hora) y tapa el borde del área cargada.

## Animales

En el pasto aparecen animales en grupos: **carpinchos** (tranquilos y nadadores; a veces con un benteveo en la cabeza), **ovejas** de lana esponjosa, **gallinas** y **conejos**. Cada especie tiene varias variantes de color.

- **Qué hacen:** pasean, pastan o picotean, se quedan mirando al jugador que está cerca, suben escalones de un bloque saltando, no se tiran de los barrancos y, si caen al agua, flotan y nadan hasta la orilla. Al carpincho le gusta meterse al agua.
- **Acariciar (clic derecho, o el gatillo izquierdo del joystick):** se pone contento, le salen corazones y te sigue un rato.
- **Empujar (clic izquierdo, o el gatillo derecho):** da un respingo y sale corriendo para el otro lado. No se lastiman.
- **Sonidos:** cada especie tiene su voz, hecha con Web Audio como el resto de los sonidos; se escuchan más bajo cuanto más lejos están.
- **Dónde aparecen:** sobre el césped, a 20–44 bloques del jugador y no justo adelante, hasta 10 cerca de cada jugador. Los que quedan lejos se van. No se guardan con el mundo: cada vez aparecen otros.
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

El protagonista de Megabrick es **Coco**, un monstruito de gomita: una bola brillante que es cabeza y cuerpo a la vez, violeta adelante y naranja y amarilla en la espalda, llena de bultitos y gotitas amarillas. Tiene ojos saltones con párpados pesados (cara de aburrido), una boca ancha con colmillos, antena en rulo, brazos finitos con pinzas y patas flacas con pies grandes de tres garras. Contrasta con el mundo de bloques pixel art. Se arma por código: geometrías y texturas se generan en el momento, sin imágenes externas.

- **Colores:** violeta (el Coco original), verde, azul, rojo, amarillo y negro. El color cambia el violeta del cuerpo; el degradé cálido y las manchas se ajustan para que se vean en todos. Se elige en la pantalla de inicio y queda guardado en el navegador. En la espalda tiene manchones de su color, así se lo reconoce desde atrás en el multijugador.
- **Expresiones:** normal (aburrido), feliz (sonrisa enorme y un bailecito), sorprendido (abre los brazos) y determinado (ceño fruncido y colmillos), más parpadeo, mirada que se mueve y algún suspiro. En la pantalla de inicio las va mostrando una por una. En el juego se pone feliz cuando sube volando y pone cara de decidido mientras rompe bloques.
- **Animación:** respira, la antena se mece como un resorte, camina y corre con los pies grandes (la bola rebota y se aplasta al pisar), vuela con los brazos abiertos y, al romper o poner, pica con la pinza derecha, donde lleva el bloque elegido. De noche baja el brillo propio.
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
    blocks.js           → tipos de bloque, sus propiedades y formas (losas, escalones, puertas)
    Chunk.js            → datos de un chunk de 16×128×16 (Uint8Array, 0 = aire)
    World.js            → chunks alrededor del jugador (carga/descarga, cola de prioridad), get/set de bloques, mallas
    ChunkWorkers.js     → grupo de Web Workers: reparte los trabajos y avisa cuando terminan
    chunkWorker.js      → el worker: genera chunks y arma sus mallas
    collision.js        → choques de una caja contra los bloques (el jugador y los animales)
    Mesher.js           → una malla por chunk con solo las caras visibles y oclusión por vértice (sin DOM: corre en los workers)
    TerrainGen.js       → terreno procedural con semilla: alturas, capas, agua, árboles y minerales
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
    Avatar.js           → el personaje en el juego: gira con la mirada, lleva el bloque en la pinza
    coco.js             → Coco: modelo, texturas, animación y expresiones, todo por código
    colors.js           → los 6 colores del personaje y sus expresiones
    RemotePlayer.js     → otro jugador: su personaje, su nombre y movimiento suavizado
    ViewCamera.js       → cámara en primera y tercera persona (tecla V)
  render/
    atlasLayout.js      → ubicación de cada textura en el atlas (sin DOM, apto para workers)
    textures.js         → dibujo procedural del atlas (pixel art 16×16)
    materials.js        → materiales por capa: opaca, recortada (hojas/vidrio) y translúcida (agua)
    Sky.js              → día y noche: cielo en degradé, sol, luna, estrellas, luces y niebla
    CharacterPreview.js → personaje girando en la pantalla de inicio
    BlockOutline.js     → contorno del bloque apuntado
    HeldItem.js         → bloque en la mano en primera persona
    blockGeometry.js    → geometría de un bloque suelto
    blockIcons.js       → íconos isométricos de los bloques (con su forma) para la hotbar y el menú
  ui/
    Hud.js              → mira, FPS, avisos y datos de F3
    Hotbar.js           → las 9 casillas de bloques
    Inventory.js        → menú de materiales (tecla E): todos los bloques por grupos
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
    Preferences.js      → preferencias del jugador (color del personaje, nombre y opciones)
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

Cada escalón usa 4 IDs (uno por orientación) y cada losa 2 (abajo y arriba): en la hotbar y en el menú se ve uno solo, y al ponerlo se elige el que corresponde. Los IDs se guardan en los mundos, así que los bloques nuevos se agregan siempre al final.

Para agregar un bloque se suma una línea en `src/world/blocks.js` (con `add`, o `addMaterial` si lleva escalones y losas) y, si necesita una textura nueva, su nombre en `src/render/atlasLayout.js` y su pintor en `src/render/textures.js`. Las formas se describen con cajas (`boxes`): con ellas se dibuja, se choca y se apunta.

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` arma el build y lo publica en GitHub Pages con cada push a `main`. Se configura una sola vez, en el repositorio:

- **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- **Settings → General → Default branch: `main`**. El entorno `github-pages` que crea GitHub solo deja publicar desde la rama por defecto (se puede cambiar en **Settings → Environments → github-pages**).

También se puede publicar a mano desde **Actions → Deploy a GitHub Pages → Run workflow**.

La ruta base del build se toma del nombre del repositorio, porque GitHub Pages distingue mayúsculas en la ruta. Con el repositorio `MegaBrick`, la versión jugable está en `https://juanmarcosmoreno-arch.github.io/MegaBrick/`; si se renombra, el build se adapta solo.
