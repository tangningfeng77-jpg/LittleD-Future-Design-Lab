// Caption boundaries are complete sentences/independent clauses, never a character quota.
// Long sentences wrap in the HUD; the answer generator is asked to speak in short sentences.
export function splitSpeechText(text){
 return String(text).match(/[^。！？!?；;]+[。！？!?；;]?[”’」』）)]*/gu)||[];
}
