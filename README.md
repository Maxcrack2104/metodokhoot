# Método Quiz Live Pro v1.1

Aplicación multijugador tipo Kahoot para **Metodología de la Investigación 2026-2**.

## Novedad v1.1
- El anfitrión ahora tiene el botón **“⏹ Terminar tiempo y mostrar respuesta”** durante cada pregunta.
- Al pulsarlo, el servidor detiene el temporizador y revela la respuesta de inmediato a todos los jugadores.
- Se añadieron `render.yaml` y `Dockerfile` para facilitar la publicación en Internet.

## Incluye
- 123 preguntas integradas + preguntas personalizadas.
- Salas multijugador con código de 6 dígitos y Socket.IO.
- Avatares, sonidos, cuenta regresiva 3-2-1, rachas, ranking y podio.
- Selección de temas y dificultad.
- Estudio individual y Simulacro Parcial sobre 20.
- Panel de creación/eliminación de preguntas.

## Ejecutar localmente
```bash
npm install
npm start
```
Abrir `http://localhost:3000`.

## Opción más simple para jugar desde cualquier red: Render
Esta versión ya está preparada como un **Web Service** Node/Socket.IO.

1. Sube la carpeta del proyecto a un repositorio de GitHub.
2. En Render crea un **Web Service** y conecta ese repositorio.
3. Build command: `npm install`
4. Start command: `npm start`
5. Render entregará una URL HTTPS pública, por ejemplo `https://metodo-quiz-live-pro.onrender.com`.
6. El anfitrión y los jugadores abren esa misma URL desde cualquier Wi‑Fi o datos móviles.

También se incluye `render.yaml` para un despliegue tipo Blueprint.

> Nota: en un servicio gratuito puede existir una espera al “despertar” después de un periodo de inactividad.

## ¿Firebase?
Firebase Hosting por sí solo sirve principalmente contenido estático; esta aplicación usa un servidor Node.js con Socket.IO y salas mantenidas en memoria. Por eso **no conviene subir esta versión tal cual solo a Firebase Hosting**.

Dos caminos posibles:
1. **Google Cloud Run:** puede ejecutar esta misma aplicación Node/Socket.IO usando el `Dockerfile` incluido y proporciona una URL pública. Es el camino Google más directo sin reescribir el juego.
2. **Firebase nativo:** reescribir la sincronización de salas y jugadores para usar Firestore o Realtime Database en lugar de Socket.IO. Así sí se puede servir el frontend desde Firebase Hosting, pero requiere cambiar la arquitectura.

Para uso de clase pequeño/mediano, Render es el camino de menor fricción para esta versión.

## Importante sobre preguntas personalizadas en hosting
Actualmente se guardan en `data/custom_questions.json`. En plataformas con sistema de archivos efímero, ese archivo puede no ser permanente después de un redeploy/reinicio. Para producción conviene mover preguntas personalizadas a una base de datos (por ejemplo Firestore, Supabase o PostgreSQL) o usar almacenamiento persistente.

## Novedades v1.2
- Al cerrar cada pregunta se muestra la distribución de respuestas A/B/C/D con barras animadas, cantidad y porcentaje.
- La respuesta correcta queda resaltada y se muestra cuántos jugadores acertaron y cuántos no respondieron.
- Al final de la partida se muestra una estadística por jugador: respuestas correctas, incorrectas, sin responder y porcentaje de aciertos.
- El anfitrión mantiene el botón **Terminar tiempo y mostrar respuesta** para cerrar una pregunta antes de que llegue a cero.
