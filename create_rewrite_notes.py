import os
import argparse

# Definiere die "Peter Brandt"-Methode als eine Liste von Checkpunkten.
# Du kannst diese Liste jederzeit anpassen oder erweitern!
PETER_BRANDT_LAYERS = [
    "Umgebungsbeschreibung (Atmosphäre, Gerüche, Geräusche, Licht)",
    "Charakterbeschreibung (Aussehen, Haltung, Kleidung der auftretenden Figuren)",
    "Innerer Monolog (Was denkt/fühlt der Protagonist oder eine andere Figur in diesem Moment?)",
    "Vorgeschichte (Andeutungen, die die Welt oder Charaktere vertiefen)",
    "Sinneswahrnehmungen (Was sieht, hört, riecht, fühlt der Knab gerade?)",
    "Vergleiche & Metaphern (Poetische Sprache, um die Szene lebendiger zu machen)",
]

def generate_notes(input_file_path):
    """
    Liest eine Markdown-Datei, extrahiert Kapitelüberschriften und erstellt
    eine neue Markdown-Datei mit einer Rewrite-Checkliste für jedes Kapitel.
    """
    # Überprüfen, ob die Eingabedatei existiert
    if not os.path.exists(input_file_path):
        print(f"Fehler: Die Datei '{input_file_path}' wurde nicht gefunden.")
        return

    # Den Ausgabedateinamen ableiten
    base_name, _ = os.path.splitext(input_file_path)
    output_file_path = f"{base_name}_rewrite_notes.md"

    # Sicherheitsabfrage, um eine bestehende Notizdatei nicht zu überschreiben
    if os.path.exists(output_file_path):
        overwrite = input(f"Die Notizdatei '{output_file_path}' existiert bereits. Überschreiben? (j/n): ").lower()
        if overwrite != 'j':
            print("Vorgang abgebrochen.")
            return

    try:
        with open(input_file_path, 'r', encoding='utf-8') as in_file, \
             open(output_file_path, 'w', encoding='utf-8') as out_file:

            print(f"Verarbeite '{input_file_path}'...")
            
            # Einen Titel für die Notizdatei schreiben
            file_title = os.path.basename(base_name).replace('_', ' ').title()
            out_file.write(f"# Rewrite-Notizen & Checkliste für: {file_title}\n\n")
            out_file.write("Nutze diese Checkliste, um jedes Kapitel nach der 'Peter Brandt'-Methode zu vertiefen.\n")

            # Die Eingabedatei Zeile für Zeile durchgehen
            for line in in_file:
                # Jede Zeile, die mit '##' beginnt, wird als Kapitelüberschrift gewertet
                stripped_line = line.strip()
                if stripped_line.startswith('##'):
                    # Eine Trennlinie für bessere Lesbarkeit
                    out_file.write("\n---\n\n")
                    # Die Kapitelüberschrift in die Notizdatei schreiben
                    out_file.write(f"## {stripped_line.lstrip('#').strip()}\n\n")
                    
                    # Die Checkliste für dieses Kapitel hinzufügen
                    out_file.write("### Peter Brandt Checkliste:\n")
                    for layer in PETER_BRANDT_LAYERS:
                        out_file.write(f"- [ ] {layer}\n")
                    
                    # Ein Bereich für freie Notizen
                    out_file.write("\n### Zusätzliche Ideen & Notizen:\n\n")
                    out_file.write("*\n\n")


        print(f"Erfolg! Deine Notizdatei wurde unter '{output_file_path}' erstellt.")

    except Exception as e:
        print(f"Ein Fehler ist aufgetreten: {e}")

if __name__ == "__main__":
    # Ermöglicht das Aufrufen des Skripts von der Kommandozeile
    parser = argparse.ArgumentParser(description="Erstellt eine Rewrite-Checkliste für eine poetische Novelle im Markdown-Format.")
    parser.add_argument("input_file", help="Der Pfad zur Markdown-Datei (z.B. poetic-novels/knabenheit.md).")
    
    args = parser.parse_args()
    
    generate_notes(args.input_file)