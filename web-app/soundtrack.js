// ==========================================================================
// PEEKABOO SOUNDTRACK — MOTEUR AUDIO PROCÉDURAL SYNTHÉTIQUE (WEB AUDIO API)
// Ambiance cinématique d'espionnage, cyber-mystère et furtivité 100% hors-ligne.
// Zéro fichier externe, zéro requête réseau, conforme CSP stricte.
// ==========================================================================

class CyberEspionageAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.filter = null;
    this.radarInterval = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // Master Volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Low-Pass Filter pour l'ambiance sombre et feutrée (espionnage sous radar)
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.setValueAtTime(170, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(3.5, this.ctx.currentTime);
    this.filter.connect(this.masterGain);

    // 1. Oscillateur Sub-Drone 1 (Fondamental 55Hz - La 1)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = "sawtooth";
    this.droneOsc1.frequency.setValueAtTime(55.0, this.ctx.currentTime);

    // 2. Oscillateur Drone 2 désaccordé pour battement binaural mystérieux (55.4 Hz)
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = "triangle";
    this.droneOsc2.frequency.setValueAtTime(55.4, this.ctx.currentTime);

    this.droneOsc1.connect(this.filter);
    this.droneOsc2.connect(this.filter);

    this.droneOsc1.start();
    this.droneOsc2.start();

    // Modulation lente du filtre pour simuler un souffle / tension d'espionnage
    this.startFilterLfo();
  }

  startFilterLfo() {
    if (!this.ctx) return;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.1, this.ctx.currentTime); // cycle de 10 secondes
    lfoGain.gain.setValueAtTime(80, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(this.filter.frequency);
    lfo.start();
  }

  playRadarPing() {
    if (!this.isPlaying || !this.ctx) return;
    try {
      const pingOsc = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      const pingFilter = this.ctx.createBiquadFilter();

      pingFilter.type = "bandpass";
      pingFilter.frequency.setValueAtTime(1380, this.ctx.currentTime);
      pingFilter.Q.setValueAtTime(9.0, this.ctx.currentTime);

      pingOsc.type = "sine";
      pingOsc.frequency.setValueAtTime(1380, this.ctx.currentTime);
      pingOsc.frequency.exponentialRampToValueAtTime(690, this.ctx.currentTime + 1.2);

      const now = this.ctx.currentTime;
      pingGain.gain.setValueAtTime(0.0, now);
      pingGain.gain.linearRampToValueAtTime(0.07, now + 0.04);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

      pingOsc.connect(pingFilter);
      pingFilter.connect(this.masterGain);

      pingOsc.start(now);
      pingOsc.stop(now + 1.8);
    } catch (e) {
      // Ignorer erreur
    }
  }

  toggle() {
    this.init();
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    if (!this.isPlaying) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.22, now + 1.5);
      this.isPlaying = true;

      this.radarInterval = setInterval(() => {
        if (Math.random() > 0.35) {
          this.playRadarPing();
        }
      }, 9500);
      this.playRadarPing();
    } else {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0, now + 0.8);
      this.isPlaying = false;
      if (this.radarInterval) clearInterval(this.radarInterval);
    }
    return this.isPlaying;
  }
}

window.peekabooSoundtrack = new CyberEspionageAudioEngine();
