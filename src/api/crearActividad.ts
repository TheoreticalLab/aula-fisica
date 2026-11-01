/**
 * Crea una actividad a partir de un Borrador (asistente «+ Crear actividad» y asistente con IA): se crea OCULTA, se
 * completa (preguntas, modo de examen, aprendizaje asistido) y solo al final se publica, para que nadie la empiece a
 * medias. Las reglas de la base de datos se cumplen en aActividad (plantillas.ts).
 */
import { createActivity, setActivityItems, updateActivity } from '@/api/docente';
import { examSettingsSave, funcionAusente } from '@/api/examen';
import { assistedSettingsSave } from '@/api/asistida';
import { aActividad, type Borrador } from '@/lib/plantillas';
import type { Activity } from '@/api/tipos';

export async function crearDesdeBorrador(b: Borrador, classId: string): Promise<Activity> {
  const act = await createActivity({ ...aActividad(b, classId), published: false });
  if (b.preguntas.length) await setActivityItems(act.id, b.preguntas);
  // sin el motor en el servidor (migración 35 sin aplicar), la evaluación queda clásica en vez de fallar a medias
  if (b.mode === 'exam' && b.examen) await examSettingsSave(act.id, b.examen).catch((e) => { if (!funcionAusente(e)) throw e; });
  if (b.asistida) {
    await assistedSettingsSave(act.id, { transferencia: b.asistida.transferencia }, null).catch((e) => {
      throw funcionAusente(e) ? new Error('La práctica se creó como borrador, pero el aprendizaje asistido aún no está activado en el servidor (falta aplicar la migración 38).') : e;
    });
  }
  if (b.publicar) await updateActivity(act.id, { published: true });
  return act;
}
