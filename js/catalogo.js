import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

document.addEventListener('DOMContentLoaded', function() {
    const btnMenu = document.querySelector('.btn-menu');
    const btnClose = document.querySelector('.btn-close');
    const mobileNavWrapper = document.querySelector('.mobile-nav-wrapper');
    const navLinks = document.querySelectorAll('.mobile-nav-wrapper .nav-link');

    btnMenu.addEventListener('click', function() {
        mobileNavWrapper.style.display = 'flex';
        setTimeout(() => {
            mobileNavWrapper.classList.add('show');
        }, 10);
    });

    function closeMenu() {
        mobileNavWrapper.classList.remove('show');
        setTimeout(() => {
            if (!mobileNavWrapper.classList.contains('show')) {
                mobileNavWrapper.style.display = 'none';
            }
        }, 300);
    }

    btnClose.addEventListener('click', closeMenu);

    mobileNavWrapper.addEventListener('click', function(e) {
        let isLink = false;
        navLinks.forEach(function(link) {
            if (link.contains(e.target)) {
                isLink = true;
            }
        });
        if (!isLink) {
            closeMenu();
        }
    });
});

/* ===== anteprime 3D del catalogo =====
   ogni riquadro .catalogo-viewer[data-src] carica il proprio modello solo quando
   entra nello schermo, e lo scarta quando esce: con ventisei file (alcuni pesanti)
   tenerli tutti caricati insieme supererebbe il numero di contesti WebGL che il
   browser permette in parallelo. Mentre è visibile, il modello ruota lentamente
   su se stesso — la stessa velocità usata per la lampada PH5 in index.html. */

const gltfLoader = new GLTFLoader();
const velocitaRotazione = 0.002; // radianti per frame, circa un giro completo al minuto

/* inquadratura: ogni modello viene scalato in base al raggio della SFERA che lo contiene
   (non al suo lato più lungo) e la telecamera è messa alla distanza minima per cui quella
   sfera sta sempre dentro al campo visivo, qualunque sia il suo angolo di rotazione in quel
   momento. Usare il raggio invece del lato più lungo evita che un modello molto "profondo"
   (come camilasaraviaruiz.glb, con parti sparse in profondità) venga tagliato ai bordi
   mentre ruota; la stessa formula per tutti i file garantisce anche che ogni occhiale
   appaia alla stessa identica scala e allo stesso livello nel riquadro. */
const RAGGIO_BERSAGLIO = 1;
const FOV_GRADI = 35;
const MARGINE_INQUADRATURA = 1.2;
const DISTANZA_CAMERA = (RAGGIO_BERSAGLIO / Math.sin(THREE.MathUtils.degToRad(FOV_GRADI / 2))) * MARGINE_INQUADRATURA;

/* alcuni file hanno, insieme agli occhiali, anche una parte estranea molto più grande
   di loro, che se non viene esclusa domina da sola l'inquadratura e la scala:
   - camilasaraviaruiz.glb e federicacancello.glb includono una testa stilizzata su cui
     sono indossati gli occhiali;
   - occhiale-3dm.glb include "mesh-0", il piedistallo d'appoggio su cui erano
     fotografati in Rhino (1287×480×1287 contro ~285 del pezzo più grande degli
     occhiali) — stessa esclusione già fatta in occhiali-configuratore.js.
   La nascondiamo per uniformare la visualizzazione con tutte le altre schede. */
const NODI_DA_NASCONDERE = {
    'glb/camilasaraviaruiz.glb': ['testa_sx', 'testa_dx'],
    'glb/federicacancello.glb': ['testa_sx', 'testa_dx'],
    'glb/occhiale-3dm.glb': ['mesh-0']
};

/* diversi file (in particolare valentinavicinanza.glb, alessandromorri.glb e
   lindagarnaroli.glb, fino a 569 segmenti) portano con sé anche le linee di
   quotatura/costruzione del disegno CAD originale: non sono triangoli pieni ma
   segmenti (THREE.Line), e nel riquadro si vedono come righe sottili vaganti sullo
   sfondo. Non c'entrano con l'occhiale vero: le togliamo da ogni modello. */
function rimuoviLineeEPunti(modello) {
    const daRimuovere = [];
    modello.traverse(function(nodo) {
        if (nodo.isLine || nodo.isPoints) {
            daRimuovere.push(nodo);
        }
    });
    daRimuovere.forEach(function(nodo) {
        nodo.parent.remove(nodo);
    });
}

/* alcuni file non hanno nessun colore assegnato nel materiale (niente baseColorFactor,
   niente texture): di loro restano bianco plastica di default, praticamente "senza
   texture". Ai materiali trovati così assegnamo un colore della stessa palette usata
   nei configuratori, uno diverso per ogni materiale del modello, invece di lasciarli
   tutti bianchi. */
const PALETTE_DEFAULT = ['#ddb892', '#9c6644', '#91171f', '#588157', '#3a5a40', '#6b8aa6', '#caa976', '#413c58'];

function assegnaColoriDiDefault(modello) {
    const materialiVisti = new Set();
    let indice = 0;
    modello.traverse(function(nodo) {
        if (!nodo.isMesh || !nodo.material) {
            return;
        }
        const materiali = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
        materiali.forEach(function(materiale) {
            if (!materiale || !materiale.color || materialiVisti.has(materiale.uuid)) {
                return;
            }
            materialiVisti.add(materiale.uuid);
            // la soglia è volutamente altissima: un baseColorFactor ASSENTE nel file
            // dà sempre bianco ESATTO (1,1,1); un bianco scelto apposta (come il
            // "Plastic" quasi bianco di Anna Porcellini, 0.957) non deve essere toccato
            const eBiancoNonImpostato = materiale.color.r > 0.999 && materiale.color.g > 0.999 && materiale.color.b > 0.999;
            if (eBiancoNonImpostato && !materiale.map) {
                materiale.color.set(PALETTE_DEFAULT[indice % PALETTE_DEFAULT.length]);
                indice += 1;
            }
        });
    });
}

/* alcuni file condividono esattamente la stessa geometria E la stessa combinazione di
   colori (es. Anna Porcellini e Takwa Guezguez: entrambi bianco e arancione) — nel
   catalogo sembrano proprio lo stesso oggetto ripetuto due volte. Qui ricoloriamo il
   "secondo" membro di ogni coppia/gruppo, materiale per materiale nell'ordine in cui
   vengono incontrati scorrendo il modello (null = lascia quel materiale com'è). */
const SOVRASCRIVI_COLORI = {
    'glb/takwaguezguez.glb': ['#2b2b2b', '#588157', null],              // Anna Porcellini resta bianco/arancione
    'glb/francescagalli.glb': ['#91171f', '#3a5a40'],                    // demariniadele/3d_occhiali_giuli restano color cuoio
    'glb/giuliacamasso.glb': ['#6b8aa6', '#413c58'],
    'glb/3d_occhiali_giuli.glb': ['#588157', '#7f5539'],
    'glb/lindagarnaroli.glb': ['#ba1f33', '#588157', '#1a1a1a', '#dad7cd', '#6b8aa6'], // alessandromorri resta verde/rosso/nero/grigio/blu originali
    'glb/luigiboccarossa.glb': ['#91171f', null, '#ddb892'],             // davidesebastianelli resta blu/nero/grigio
    'glb/federicacancello.glb': ['#3a5a40', null],                       // camilasaraviaruiz resta con la lente blu
    'glb/SofiaBezzicheri.glb': ['#410b13', '#344e41', '#b08968', '#1a1a1a'], // Eleonora Nobili resta nero/rosso/menta/bosco
    'glb/gianmarcotito.glb': ['#9c6644', '#410b13', '#dad7cd'],           // 3 colori diversi, uno per componente (non più monocolore)
    'glb/giacomocerioni.glb': ['#91171f', '#588157', '#1a1a1a'],
    'glb/Jacopo_Del_Bianco.glb': ['#344e41', '#b08968', '#7f5539']        // stesso file di gianmarcotito: restava tutto bianco, qui gli diamo una terna diversa
};

function applicaSovrascritturaColori(datasrc, modello) {
    const sovrascrizioni = SOVRASCRIVI_COLORI[datasrc];
    if (!sovrascrizioni) {
        return;
    }
    const materialiVisti = new Set();
    let indice = 0;
    modello.traverse(function(nodo) {
        if (!nodo.isMesh || !nodo.material) {
            return;
        }
        const materiali = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
        materiali.forEach(function(materiale) {
            if (!materiale || !materiale.color || materialiVisti.has(materiale.uuid)) {
                return;
            }
            materialiVisti.add(materiale.uuid);
            const colore = sovrascrizioni[indice];
            if (colore) {
                materiale.color.set(colore);
            }
            indice += 1;
        });
    });
}

/* pivot di rotazione: il centro del bounding box (usato all'inizio) non è il baricentro
   reale della geometria. Per un modello con parti sparse in modo asimmetrico (come
   occhiale-3dm.glb, dopo aver tolto il piedistallo) quel centro può cadere in un punto
   dove non c'è quasi geometria: il modello sembra allora "oscillare" largamente intorno
   a un perno invece di girare composto su se stesso. Calcoliamo invece una sfera centrata
   sulla media reale dei vertici, con il raggio minimo che li contiene tutti: più lento da
   calcolare (un giro su tutti i vertici) ma il modello gira in modo molto più stabile. */
function sferaDaiVertici(modello) {
    modello.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const somma = new THREE.Vector3();
    let conteggio = 0;

    modello.traverse(function(nodo) {
        if (!nodo.isMesh) {
            return;
        }
        const posizioni = nodo.geometry.attributes.position;
        if (!posizioni) {
            return;
        }
        for (let i = 0; i < posizioni.count; i++) {
            v.fromBufferAttribute(posizioni, i).applyMatrix4(nodo.matrixWorld);
            somma.add(v);
            conteggio += 1;
        }
    });

    if (conteggio === 0) {
        return new THREE.Sphere(new THREE.Vector3(), 0.0001);
    }

    const centro = somma.divideScalar(conteggio);
    let raggio = 0;

    modello.traverse(function(nodo) {
        if (!nodo.isMesh) {
            return;
        }
        const posizioni = nodo.geometry.attributes.position;
        if (!posizioni) {
            return;
        }
        for (let i = 0; i < posizioni.count; i++) {
            v.fromBufferAttribute(posizioni, i).applyMatrix4(nodo.matrixWorld);
            raggio = Math.max(raggio, v.distanceTo(centro));
        }
    });

    return new THREE.Sphere(centro, Math.max(raggio, 0.0001));
}

const riquadri = document.querySelectorAll('.catalogo-viewer[data-src]');

const osservatore = new IntersectionObserver(function(voci) {
    voci.forEach(function(voce) {
        if (voce.isIntersecting) {
            avviaAnteprima(voce.target);
        } else {
            fermaAnteprima(voce.target);
        }
    });
}, { rootMargin: '200px 0px' });

riquadri.forEach(function(riquadro) {
    osservatore.observe(riquadro);
});

/* comparsa delle card quando entrano nello schermo: osservatore a parte da quello
   dei modelli 3D perché deve coprire anche la scheda senza anteprima (il file non
   convertito), che l'altro osservatore non vede mai */
const osservatoreComparsa = new IntersectionObserver(function(voci) {
    voci.forEach(function(voce) {
        if (voce.isIntersecting) {
            voce.target.classList.add('visibile');
            osservatoreComparsa.unobserve(voce.target);
        }
    });
}, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });

/* click sulla card → apre la scheda dedicata (nome, descrizione, colori per
   componente, misure, prova virtuale): scheda.html legge il modello da mostrare
   dal parametro "file" nell'indirizzo. Le due card di "Anche nel sito" hanno
   già una pagina propria (occhiali.html, index.html) indicata con data-href. */
document.querySelectorAll('.catalogo-card').forEach(function(scheda) {
    osservatoreComparsa.observe(scheda);

    const riquadro = scheda.querySelector('.catalogo-viewer');
    const destinazione = scheda.dataset.href ||
        (riquadro && riquadro.dataset.src ? 'scheda.html?file=' + encodeURIComponent(riquadro.dataset.src) : null);
    if (!destinazione) {
        return; // nessun modello da mostrare per questa card
    }
    scheda.classList.add('cliccabile');
    scheda.addEventListener('click', function(e) {
        if (e.target.closest('a')) {
            return; // lascia gestire al link interno (es. verso occhiali.html nel testo)
        }
        window.location.href = destinazione;
    });
});

function avviaAnteprima(riquadro) {
    if (riquadro._attiva) {
        return;
    }
    riquadro._attiva = true;

    const scena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV_GRADI, riquadro.clientWidth / riquadro.clientHeight, 0.01, 1000);
    camera.position.set(0, 0, DISTANZA_CAMERA);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(riquadro.clientWidth, riquadro.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    riquadro.appendChild(renderer.domElement);

    // alcuni materiali originali (vetro, metallo) usano riflessi/trasmissione e senza un
    // ambiente da riflettere risultano quasi del tutto invisibili: questo ambiente generato
    // (standard in three.js, non è una foto reale) gli dà qualcosa da riflettere. Va rifatto
    // per ogni riquadro perché ogni riquadro ha il proprio contesto WebGL.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    scena.add(new THREE.AmbientLight(0xffffff, 0.75));
    const luceDirezionale = new THREE.DirectionalLight(0xffffff, 1.2);
    luceDirezionale.position.set(3, 6, 4);
    scena.add(luceDirezionale);

    riquadro._renderer = renderer;
    riquadro._camera = camera;
    riquadro._scena = scena;
    riquadro._modello = null;

    const url = encodeURI(riquadro.dataset.src);

    gltfLoader.load(url, function(gltf) {
        // il riquadro potrebbe essere uscito dallo schermo mentre il file era ancora in scaricamento
        if (!riquadro._attiva) {
            return;
        }

        const modello = gltf.scene;

        rimuoviLineeEPunti(modello);

        const daNascondere = NODI_DA_NASCONDERE[riquadro.dataset.src] || [];
        if (daNascondere.length) {
            const nodiTrovati = [];
            modello.traverse(function(nodo) {
                if (daNascondere.includes(nodo.name)) {
                    nodiTrovati.push(nodo);
                }
            });
            nodiTrovati.forEach(function(nodo) {
                nodo.parent.remove(nodo);
            });
        }

        assegnaColoriDiDefault(modello);
        applicaSovrascritturaColori(riquadro.dataset.src, modello);

        const sfera = sferaDaiVertici(modello);
        const scala = RAGGIO_BERSAGLIO / Math.max(sfera.radius, 0.0001);

        // il modello va spostato per portare il suo baricentro all'origine, e scalato:
        // finora lo facevamo spostando "modello" stesso e poi ruotandolo — ma la rotazione
        // di un oggetto avviene sempre intorno alla SUA origine locale (0,0,0), non intorno
        // al punto che vediamo al centro del riquadro. Se il baricentro del file originale
        // è lontano dall'origine (come in occhiale-3dm.glb, con coordinate Rhino dell'ordine
        // delle migliaia), "modello" ruotando intorno alla propria origine fa ORBITARE il
        // baricentro invece di farlo girare su se stesso: il risultato è un modello che
        // sembra schizzare fuori dall'inquadratura invece di ruotare composto.
        // Soluzione: un gruppo "perno" che sta fermo all'origine ed è lui a ruotare; dentro
        // c'è "modello", spostato in modo che il suo baricentro coincida esattamente con
        // l'origine del perno. Così la rotazione avviene sempre intorno al baricentro vero.
        modello.scale.setScalar(scala);
        modello.position.copy(sfera.center).multiplyScalar(-scala);

        const perno = new THREE.Group();
        perno.add(modello);
        scena.add(perno);
        riquadro._modello = perno;
        riquadro.classList.add('pronto');
    }, undefined, function() {
        if (!riquadro._attiva) {
            return;
        }
        mostraErrore(riquadro);
    });

    function anima() {
        if (!riquadro._attiva) {
            return;
        }
        riquadro._frameId = requestAnimationFrame(anima);
        if (riquadro._modello) {
            riquadro._modello.rotation.y += velocitaRotazione;
        }
        renderer.render(scena, camera);
    }
    anima();
}

function fermaAnteprima(riquadro) {
    if (!riquadro._attiva) {
        return;
    }
    riquadro._attiva = false;

    if (riquadro._frameId) {
        cancelAnimationFrame(riquadro._frameId);
        riquadro._frameId = null;
    }

    if (riquadro._scena) {
        if (riquadro._scena.environment) {
            riquadro._scena.environment.dispose();
        }
        riquadro._scena.traverse(function(nodo) {
            if (!nodo.isMesh) {
                return;
            }
            nodo.geometry.dispose();
            const materiali = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
            materiali.forEach(function(materiale) {
                if (materiale) {
                    materiale.dispose();
                }
            });
        });
    }

    if (riquadro._renderer) {
        riquadro._renderer.dispose();
        riquadro._renderer.domElement.remove();
    }

    riquadro.classList.remove('pronto');
    riquadro._renderer = null;
    riquadro._camera = null;
    riquadro._scena = null;
    riquadro._modello = null;
}

function mostraErrore(riquadro) {
    fermaAnteprima(riquadro);
    riquadro.classList.add('pronto', 'non-disponibile');
    const avviso = document.createElement('p');
    avviso.className = 'catalogo-avviso';
    avviso.textContent = 'Anteprima non disponibile';
    riquadro.appendChild(avviso);
}

window.addEventListener('resize', function() {
    riquadri.forEach(function(riquadro) {
        if (!riquadro._attiva || !riquadro._renderer || !riquadro._camera) {
            return;
        }
        riquadro._camera.aspect = riquadro.clientWidth / riquadro.clientHeight;
        riquadro._camera.updateProjectionMatrix();
        riquadro._renderer.setSize(riquadro.clientWidth, riquadro.clientHeight);
    });
});
