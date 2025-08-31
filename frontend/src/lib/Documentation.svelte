<script>
  import Md from "./utils/MD.svelte";
  import { translations, userSettings } from '$lib/utils/store.js';

  let {topic}= $props();

  const all_topics = {
    "inference":{
      "en":`# Using the Prediction Page

The **Prediction Page** enables you to apply AI models to your own data and obtain results such as object detection or highlighted image regions. This guide explains the process step by step.

---

## 1. Select a Model
- Use the dropdown menu at the top to choose the model you would like to run.  
- Example: **Detect objects in images**  
  - Identifies and labels common objects such as people, cars, or animals.  
  - **Input:** JPG/PNG images  
  - **Output:** Images with bounding boxes or highlighted objects.  

---

## 2. Upload Your Data
- Drag and drop individual files or a compressed \`.zip\` folder into the upload area.  
- The system will confirm how many files have been detected (e.g., *Found: 2 images*).  
- **Important:** All processing occurs locally in your browser. Uploaded data remains on your device and is not transmitted externally.  

---

## 3. Run the Prediction
- Once a model is selected and data is uploaded, click **Run** to start the process.  
- The system will proceed through several stages:  
  1. Initializing  
  2. Loading data  
  3. Running the model  
  4. Completed  

Processing time is typically a few seconds, depending on the size of the input data.  

---

## 4. Review and Export Results
- After processing, a summary will be displayed (e.g., *Object detection of 2 files using tf.coco-ssd*).  
- Results can be accessed in two ways:  
  - **Preview:** Inspect the processed files directly in the application.  
  - **Export:** Download results in various formats, including:  
    - Original files  
    - Images with bounding boxes or overlays  
    - Cropped images of detected objects  
    - Lists of detected objects  

---

## Additional Notes
- Ensure that uploaded files are in a supported format (e.g., \`.jpg\`, \`.png\`).  
- If the system indicates *“No model selected”*, return to Step 1.  
- If the system indicates *“No data uploaded”*, return to Step 2.  

`,
      "de":`# Verwendung der Vorhersageseite

Die **Vorhersageseite** ermöglicht es Ihnen, KI-Modelle auf eigene Daten anzuwenden und Ergebnisse wie Objekterkennung oder markierte Bildbereiche zu erhalten. Diese Anleitung führt Sie Schritt für Schritt durch den Prozess.

---

## 1. Modell auswählen
- Verwenden Sie das Dropdown-Menü oben, um das gewünschte Modell auszuwählen.  
- Beispiel: **Objekte in Bildern erkennen**  
  - Identifiziert und kennzeichnet gängige Objekte wie Personen, Autos oder Tiere.  
  - **Eingabe:** JPG/PNG-Bilder  
  - **Ausgabe:** Bilder mit Begrenzungsrahmen oder markierten Objekten  

---

## 2. Daten hochladen
- Ziehen Sie einzelne Dateien oder einen komprimierten \`.zip\`-Ordner in den Upload-Bereich.  
- Das System bestätigt, wie viele Dateien erkannt wurden (z. B. *Gefunden: 2 Bilder*).  
- **Wichtig:** Die Verarbeitung erfolgt ausschließlich lokal in Ihrem Browser. Hochgeladene Daten bleiben auf Ihrem Gerät und werden nicht extern übertragen.  

---

## 3. Vorhersage starten
- Sobald ein Modell ausgewählt und Daten hochgeladen wurden, klicken Sie auf **Start**, um die Verarbeitung zu beginnen.  
- Das System durchläuft mehrere Phasen:  
  1. Initialisierung  
  2. Laden der Daten  
  3. Ausführung des Modells  
  4. Abgeschlossen  

Die Bearbeitung dauert in der Regel nur wenige Sekunden, abhängig von der Größe der Eingabedaten.  

---

## 4. Ergebnisse prüfen und exportieren
- Nach Abschluss wird eine Zusammenfassung angezeigt (z. B. *Objekterkennung von 2 Dateien mit tf.coco-ssd*).  
- Ergebnisse können auf zwei Arten genutzt werden:  
  - **Vorschau:** Anzeige der verarbeiteten Dateien direkt in der Anwendung.  
  - **Export:** Herunterladen der Ergebnisse in verschiedenen Formaten, darunter:  
    - Originaldateien  
    - Bilder mit Begrenzungsrahmen oder Überlagerungen  
    - Ausgeschnittene Bilder der erkannten Objekte  
    - Listen der erkannten Objekte  

---

## Zusätzliche Hinweise
- Stellen Sie sicher, dass die hochgeladenen Dateien ein unterstütztes Format haben (z. B. \`.jpg\`, \`.png\`).  
- Wenn die Meldung *„Kein Modell ausgewählt“* erscheint, kehren Sie zu Schritt 1 zurück.  
- Wenn die Meldung *„Keine Daten hochgeladen“* erscheint, kehren Sie zu Schritt 2 zurück.  
`
    },
    "training":`Train`,
    "convert":`Convert`,
    "settings":`Settings`
  }

  let selected_text = $derived(all_topics[topic][$userSettings["language"]])

</script>
<div style="overflow-y:scroll;">
  {#if topic}  
  {#if topic === 'inference'}
    <Md  markdown={all_topics.inference[[$userSettings["language"]]]}/>
  {:else if topic === 'training'}
    <Md  markdown={all_topics.training[[$userSettings["language"]]]}/>
  {:else if topic === 'convert'}
    <Md  markdown={all_topics.convert[$userSettings["language"]]}/>
  {:else if topic === 'settings'}
    <Md  markdown={all_topics.settings[$userSettings["language"]]}/>
  {:else}
    <p>Documentation for <strong>{topic}</strong> is not available.</p>
  {/if}
{/if}


</div>

