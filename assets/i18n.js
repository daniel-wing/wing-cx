/* Every visible string on the site, in both languages.
   English is the fallback for anything missing, so a gap here shows the
   original wording rather than an empty element. */

window.WING_STRINGS = {
  en: {
    /* ---- shell ---- */
    'nav.ships': 'Ships',
    'nav.signals': 'Signals',
    'nav.linkedin': 'LinkedIn',
    'nav.sayhi': 'Say hi',
    'lang.label': 'Language',

    /* ---- home ---- */
    'home.title': 'Wing — wing.cx',
    'home.h1.name': 'Daniel Wing',
    'home.h1.line2': 'AI & Analytics for',
    'home.h1.line3': 'Customer Experience',
    'home.bio': 'Turning raw user feedback into clean data, and clean data into AI solutions that stick.',
    'home.cta.ships': 'View my ships',

    /* ---- ships index ---- */
    'ships.title': 'Ships — wing.cx',
    'ships.h1': 'Ships.',
    'ships.lede': "Things I've built and actually put out there. All free, no sign-up, no account — just open the page and use it.",
    'ships.status.live': 'Live',
    'ships.scribe.name': 'Scribe',
    'ships.scribe.desc': 'Drop in a video or audio file and get a clean transcript plus subtitles. Whisper runs inside your own browser, so the file never leaves your machine and there is nothing to pay for.',
    'ships.scribe.tag1': 'Whisper',
    'ships.scribe.tag2': 'WebGPU',
    'ships.scribe.tag3': 'Private',
    'ships.open': 'Open',
    'ships.more': 'More on the way',

    /* ---- signals index ---- */
    'signals.title': 'Signals — wing.cx',
    'signals.h1': 'Signals.',
    'signals.lede': "Data stories: what the numbers turned out to be saying once someone actually looked. Charts, write-ups, and the occasional uncomfortable finding.",
    'signals.more': 'First one in the works',
    'signals.crumb': 'Signals',

    /* ---- scribe: header ---- */
    'scribe.title': 'Scribe — wing.cx',
    'scribe.h1': 'Scribe.',
    'scribe.lede': 'Drop in a video or audio file and get a clean transcript plus subtitles. Free, no sign-up, no account.',
    'scribe.privacy': 'Everything runs inside your browser. Your file is never uploaded anywhere.',
    'scribe.crumb': 'Scribe',

    /* ---- scribe: engine ---- */
    'scribe.engine': 'Engine',
    'scribe.model': 'Model',
    'scribe.language': 'Language',
    'scribe.runtime': 'Runtime',
    'scribe.lang.auto': 'Detect automatically',
    'scribe.hint.language': 'The language is detected from the audio itself, and whatever it settles on is shown with the result, so a wrong guess is visible rather than silent. If it ever picks wrong, set the language here and run it again.',
    'scribe.hint.gpu': 'Your GPU will do the work. The model downloads once, then your browser caches it, so later visits start instantly.',
    'scribe.hint.cpu': 'Your browser has no WebGPU, so this falls back to the CPU and will be noticeably slower. Chrome or Edge on a desktop gives you the fast path.',
    'scribe.hint.mobile': 'This runs on the CPU. Phones do advertise GPU support, but using it here crashes the tab outright, so the slower path is the one that actually finishes.',
    'scribe.runtime.checking': 'Checking…',
    'scribe.runtime.cpu': 'CPU (WASM)',
    'scribe.runtime.cpuMobile': 'CPU (safest here)',
    'scribe.mobileNote': 'You are on a phone, so this uses the smallest model and the CPU rather than the GPU. Phones advertise GPU support but crash the tab when it is actually used for this, so the slower route is the one that finishes. It is a {mb} MB one-time download. Expect roughly a minute per minute of recording; for anything longer, or for better accuracy, the <a href="#desktop">desktop version</a> is far quicker and has no limit.',

    /* ---- scribe: models ---- */
    'scribe.model.tiny': 'Tiny — fastest, roughest',
    'scribe.model.base': 'Base — balanced',
    'scribe.model.small': 'Small — most accurate, and no slower on a GPU',

    /* ---- scribe: dropzone and file ---- */
    'scribe.drop.title': 'Drop a video or audio file',
    'scribe.drop.sub': 'or click to browse — MP4, MOV, M4V, WebM, MP3, M4A, WAV',
    'scribe.drop.aria': 'Choose a video or audio file',
    'scribe.file.remove': 'Remove file',
    'scribe.run': 'Generate transcript',
    'scribe.running': 'Working…',
    'scribe.cancel': 'Cancel',

    /* ---- scribe: estimates and progress ---- */
    'scribe.est.under': 'Should take under a minute.',
    'scribe.est.range': 'Roughly {low}–{high} min, depending on your computer.',
    'scribe.left.almost': 'Almost done.',
    'scribe.left.under': 'Less than a minute left.',
    'scribe.left.about1': 'About a minute left.',
    'scribe.left.min': 'About {n} min left.',
    'scribe.left.hr': 'About {n} hr left.',
    'scribe.stage.reading': 'Reading the audio…',
    'scribe.stage.preparing': 'Preparing the model…',
    'scribe.stage.warming': 'Warming up your GPU…',
    'scribe.stage.detecting': 'Working out the language…',
    'scribe.stage.transcribing': 'Transcribing…',
    'scribe.stage.segment': 'Transcribing — segment {n} of {total}',
    'scribe.download.label': 'Downloading the speech model — {loaded} of {total}',
    'scribe.download.why': '<strong>Why is it downloading something?</strong> Because the transcription happens on your computer, the speech model has to come to your file, rather than your file being sent off to someone else\'s computer. That is the whole trade: a one-time download instead of uploading your video to a server. Your browser keeps the model afterwards, so this only happens once.',

    /* ---- scribe: advice and errors ---- */
    'scribe.advice.lead.high': 'This is more than {where} can comfortably hold in memory.',
    'scribe.advice.lead.medium': 'This is close to what {where} can hold in memory.',
    'scribe.advice.where.phone': 'a phone',
    'scribe.advice.where.tab': 'a browser tab',
    'scribe.advice.cause.model': 'The {model} model is the bulk of it, so a smaller model is the quickest fix.',
    'scribe.advice.cause.length': 'A recording this long is the bulk of it.',
    'scribe.advice.body': 'If it runs out, the tab reloads and the work is lost, with no warning from the browser. You can still try it. The <a href="#desktop">desktop version</a> has no such limit and is considerably faster.',
    'scribe.err.decode': '<strong>Could not read the audio from that file.</strong> Your browser cannot decode this container or codec — MKV and AVI usually fail here. Re-saving it as MP4, WebM, M4A or WAV will fix it.',
    'scribe.err.noaudio': '<strong>That file has no audio track.</strong>',
    'scribe.err.nospeech': '<strong>Nothing to transcribe.</strong> No speech was detected in that file.',
    'scribe.err.failed': '<strong>Transcription failed.</strong> {message}',
    'scribe.err.worker': 'The transcription worker failed to start.',

    /* ---- scribe: output ---- */
    'scribe.transcript': 'Transcript',
    'scribe.tab.text': 'Text',
    'scribe.tab.srt': 'SRT',
    'scribe.copy': 'Copy',
    'scribe.copied': 'Copied',
    'scribe.copyManual': 'Press ⌘C',
    'scribe.dl.txt': 'Download .txt',
    'scribe.dl.srt': 'Download .srt',
    'scribe.done': 'Done in {time}',
    'scribe.done.detected': 'detected {language}',
    'scribe.done.unsure': 'detected {language}, but not confidently',
    'scribe.langCheck': 'Not {language}? Pick the right language above and run it again.',

    /* ---- scribe: desktop section ---- */
    'scribe.desktop.label': 'Long recording?',
    'scribe.desktop.title': 'Get the desktop version.',
    'scribe.desktop.lede': 'This page keeps the whole recording in memory, so somewhere past an hour your browser may give up. The desktop version runs the same job as an ordinary program on your computer, with no length limit, no internet needed, and roughly fifteen times faster than real time. Your file stays on your machine either way.',
    'scribe.desktop.macSilicon': 'Apple Silicon (M1 and newer)',
    'scribe.desktop.macIntel': 'Intel processor',
    'scribe.desktop.windows': 'Windows 10 and 11, 64-bit',
    'scribe.desktop.dmg': 'Download .dmg',
    'scribe.desktop.exe': 'Download .exe',
    'scribe.desktop.whichMac': 'Not sure which Mac you have? Apple menu, then About This Mac. If it mentions M1, M2, M3 or M4, take the Apple Silicon one.',
    'scribe.desktop.warn': '<strong>You will see a security warning, and you should know why.</strong> These downloads are not code-signed, because signing certificates cost money every year and this is free. So macOS and Windows will both tell you the developer is unverified. Nothing is wrong with the file, but please do not take that on trust from me.',
    'scribe.desktop.trust': 'Read the code instead. Every line is on GitHub, and every download is built there in public from that source, so you can see exactly what went into the file before you run it. The installation instructions are in the README.',
    'scribe.desktop.source': 'Read the source on GitHub',

    /* ---- footer ---- */
    'footer.powered': 'Powered by OpenAI Whisper via transformers.js',
    'footer.copyright': '© Daniel Wing',
  },

  es: {
    /* ---- shell ---- */
    'nav.ships': 'Proyectos',
    'nav.signals': 'Señales',
    'nav.linkedin': 'LinkedIn',
    'nav.sayhi': 'Saluda',
    'lang.label': 'Idioma',

    /* ---- home ---- */
    'home.title': 'Wing — wing.cx',
    'home.h1.name': 'Daniel Wing',
    'home.h1.line2': 'IA y Analítica para',
    'home.h1.line3': 'Experiencia de Cliente',
    'home.bio': 'Convierto comentarios de usuarios en datos limpios, y datos limpios en soluciones de IA que perduran.',
    'home.cta.ships': 'Ver mis proyectos',

    /* ---- ships index ---- */
    'ships.title': 'Proyectos — wing.cx',
    'ships.h1': 'Proyectos.',
    'ships.lede': 'Cosas que he construido y he puesto a disposición de todos. Gratis, sin registro y sin cuenta: abre la página y úsala.',

    /* ---- signals index ---- */
    'signals.title': 'Señales — wing.cx',
    'signals.h1': 'Señales.',
    'signals.lede': 'Historias con datos: lo que resultó que decían los números cuando alguien se puso a mirarlos de verdad. Gráficos, análisis y algún que otro hallazgo incómodo.',
    'signals.more': 'La primera, en camino',
    'signals.crumb': 'Señales',
    'ships.status.live': 'En línea',
    'ships.scribe.name': 'Scribe',
    'ships.scribe.desc': 'Suelta un archivo de vídeo o audio y obtén una transcripción limpia junto con los subtítulos. Whisper se ejecuta dentro de tu propio navegador, así que el archivo nunca sale de tu equipo y no hay nada que pagar.',
    'ships.scribe.tag1': 'Whisper',
    'ships.scribe.tag2': 'WebGPU',
    'ships.scribe.tag3': 'Privado',
    'ships.open': 'Abrir',
    'ships.more': 'Pronto habrá más',

    /* ---- scribe: header ---- */
    'scribe.title': 'Scribe — wing.cx',
    'scribe.h1': 'Scribe.',
    'scribe.lede': 'Suelta un archivo de vídeo o audio y obtén una transcripción limpia junto con los subtítulos. Gratis, sin registro y sin cuenta.',
    'scribe.privacy': 'Todo se ejecuta dentro de tu navegador. Tu archivo no se sube a ningún sitio.',
    'scribe.crumb': 'Scribe',

    /* ---- scribe: engine ---- */
    'scribe.engine': 'Motor',
    'scribe.model': 'Modelo',
    'scribe.language': 'Idioma',
    'scribe.runtime': 'Ejecución',
    'scribe.lang.auto': 'Detectar automáticamente',
    'scribe.hint.language': 'El idioma se detecta a partir del propio audio, y el resultado indica cuál ha elegido, de modo que un error se ve en lugar de pasar desapercibido. Si se equivoca, elige aquí el idioma y vuelve a ejecutarlo.',
    'scribe.hint.gpu': 'Tu GPU hará el trabajo. El modelo se descarga una sola vez y tu navegador lo guarda, así que las siguientes visitas empiezan al instante.',
    'scribe.hint.cpu': 'Tu navegador no tiene WebGPU, así que esto recurre a la CPU y será bastante más lento. Chrome o Edge en un ordenador te dan la vía rápida.',
    'scribe.hint.mobile': 'Esto se ejecuta en la CPU. Los móviles dicen tener soporte de GPU, pero usarla aquí hace que la pestaña se cierre, así que la vía lenta es la que de verdad termina.',
    'scribe.runtime.checking': 'Comprobando…',
    'scribe.runtime.cpu': 'CPU (WASM)',
    'scribe.runtime.cpuMobile': 'CPU (lo más seguro aquí)',
    'scribe.mobileNote': 'Estás en un móvil, así que se usa el modelo más pequeño y la CPU en lugar de la GPU. Los móviles dicen tener soporte de GPU, pero al usarla para esto la pestaña se cierra, así que la vía lenta es la que termina. Es una descarga única de {mb} MB. Cuenta con más o menos un minuto por cada minuto de grabación; para algo más largo, o para más precisión, la <a href="#desktop">versión de escritorio</a> es mucho más rápida y no tiene límite.',

    /* ---- scribe: models ---- */
    'scribe.model.tiny': 'Tiny — el más rápido, el más impreciso',
    'scribe.model.base': 'Base — equilibrado',
    'scribe.model.small': 'Small — el más preciso, y no más lento con GPU',

    /* ---- scribe: dropzone and file ---- */
    'scribe.drop.title': 'Suelta un archivo de vídeo o audio',
    'scribe.drop.sub': 'o pulsa para buscarlo — MP4, MOV, M4V, WebM, MP3, M4A, WAV',
    'scribe.drop.aria': 'Elige un archivo de vídeo o audio',
    'scribe.file.remove': 'Quitar archivo',
    'scribe.run': 'Generar transcripción',
    'scribe.running': 'Trabajando…',
    'scribe.cancel': 'Cancelar',

    /* ---- scribe: estimates and progress ---- */
    'scribe.est.under': 'Debería tardar menos de un minuto.',
    'scribe.est.range': 'Entre {low} y {high} min aproximadamente, según tu ordenador.',
    'scribe.left.almost': 'Ya casi está.',
    'scribe.left.under': 'Queda menos de un minuto.',
    'scribe.left.about1': 'Queda alrededor de un minuto.',
    'scribe.left.min': 'Quedan unos {n} min.',
    'scribe.left.hr': 'Quedan unas {n} h.',
    'scribe.stage.reading': 'Leyendo el audio…',
    'scribe.stage.preparing': 'Preparando el modelo…',
    'scribe.stage.warming': 'Calentando tu GPU…',
    'scribe.stage.detecting': 'Averiguando el idioma…',
    'scribe.stage.transcribing': 'Transcribiendo…',
    'scribe.stage.segment': 'Transcribiendo — fragmento {n} de {total}',
    'scribe.download.label': 'Descargando el modelo de voz — {loaded} de {total}',
    'scribe.download.why': '<strong>¿Por qué está descargando algo?</strong> Como la transcripción ocurre en tu ordenador, el modelo de voz tiene que venir hasta tu archivo, en vez de enviar tu archivo al ordenador de otra persona. Ese es todo el intercambio: una descarga única en lugar de subir tu vídeo a un servidor. Tu navegador guarda el modelo después, así que esto solo pasa una vez.',

    /* ---- scribe: advice and errors ---- */
    'scribe.advice.lead.high': 'Esto es más de lo que {where} puede mantener cómodamente en memoria.',
    'scribe.advice.lead.medium': 'Esto se acerca al límite de lo que {where} puede mantener en memoria.',
    'scribe.advice.where.phone': 'un móvil',
    'scribe.advice.where.tab': 'una pestaña del navegador',
    'scribe.advice.cause.model': 'El modelo {model} es la mayor parte, así que elegir uno más pequeño es la solución más rápida.',
    'scribe.advice.cause.length': 'Una grabación tan larga es la mayor parte.',
    'scribe.advice.body': 'Si se queda sin memoria, la pestaña se recarga y se pierde el trabajo, sin ningún aviso del navegador. Aun así puedes intentarlo. La <a href="#desktop">versión de escritorio</a> no tiene ese límite y es bastante más rápida.',
    'scribe.err.decode': '<strong>No se ha podido leer el audio de ese archivo.</strong> Tu navegador no puede descodificar este contenedor o códec — MKV y AVI suelen fallar aquí. Volver a guardarlo como MP4, WebM, M4A o WAV lo soluciona.',
    'scribe.err.noaudio': '<strong>Ese archivo no tiene pista de audio.</strong>',
    'scribe.err.nospeech': '<strong>No hay nada que transcribir.</strong> No se ha detectado voz en ese archivo.',
    'scribe.err.failed': '<strong>La transcripción ha fallado.</strong> {message}',
    'scribe.err.worker': 'El proceso de transcripción no ha podido arrancar.',

    /* ---- scribe: output ---- */
    'scribe.transcript': 'Transcripción',
    'scribe.tab.text': 'Texto',
    'scribe.tab.srt': 'SRT',
    'scribe.copy': 'Copiar',
    'scribe.copied': 'Copiado',
    'scribe.copyManual': 'Pulsa ⌘C',
    'scribe.dl.txt': 'Descargar .txt',
    'scribe.dl.srt': 'Descargar .srt',
    'scribe.done': 'Listo en {time}',
    'scribe.done.detected': 'idioma detectado: {language}',
    'scribe.done.unsure': 'idioma detectado: {language}, pero sin mucha certeza',
    'scribe.langCheck': '¿No es {language}? Elige arriba el idioma correcto y vuelve a ejecutarlo.',

    /* ---- scribe: desktop section ---- */
    'scribe.desktop.label': '¿Grabación larga?',
    'scribe.desktop.title': 'Descarga la versión de escritorio.',
    'scribe.desktop.lede': 'Esta página mantiene toda la grabación en memoria, así que a partir de una hora tu navegador puede rendirse. La versión de escritorio hace el mismo trabajo como un programa normal en tu ordenador, sin límite de duración, sin necesidad de internet y unas quince veces más rápido que el tiempo real. En ambos casos tu archivo se queda en tu equipo.',
    'scribe.desktop.macSilicon': 'Apple Silicon (M1 y posteriores)',
    'scribe.desktop.macIntel': 'Procesador Intel',
    'scribe.desktop.windows': 'Windows 10 y 11, 64 bits',
    'scribe.desktop.dmg': 'Descargar .dmg',
    'scribe.desktop.exe': 'Descargar .exe',
    'scribe.desktop.whichMac': '¿No sabes qué Mac tienes? Menú Apple y luego Acerca de este Mac. Si menciona M1, M2, M3 o M4, coge la de Apple Silicon.',
    'scribe.desktop.warn': '<strong>Verás un aviso de seguridad, y conviene que sepas por qué.</strong> Estas descargas no están firmadas, porque los certificados de firma cuestan dinero cada año y esto es gratis. Así que tanto macOS como Windows te dirán que el desarrollador no está verificado. El archivo no tiene nada malo, pero por favor no te fíes de eso solo porque yo lo diga.',
    'scribe.desktop.trust': 'Mejor lee el código. Cada línea está en GitHub, y cada descarga se construye allí en público a partir de ese código, así que puedes ver exactamente qué contiene el archivo antes de ejecutarlo. Las instrucciones de instalación están en el README.',
    'scribe.desktop.source': 'Ver el código en GitHub',

    /* ---- footer ---- */
    'footer.powered': 'Con OpenAI Whisper a través de transformers.js',
    'footer.copyright': '© Daniel Wing',
  },
};
