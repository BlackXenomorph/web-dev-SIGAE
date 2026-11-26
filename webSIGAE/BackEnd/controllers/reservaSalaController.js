// Reserva de sala multiuso (RF63 / CU109).
// Actores autorizados: Super Administrador, Administrador y Docente.
const pool = require('../config/db');

const ROLES_AUTORIZADOS = ['Super Administrador', 'Super Admin', 'Administrador', 'Docente'];

const puedeReservar = (user) =>
  (user?.roles || []).some((rol) => ROLES_AUTORIZADOS.includes(rol));

const formatearHora = (valor) => (valor ? String(valor).slice(0, 5) : '');

const hoyLocal = () => {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// GET /api/reservas-sala?fecha=YYYY-MM-DD
// Devuelve los bloques horarios y las reservas ya registradas para esa fecha.
const getReservasPorFecha = async (req, res) => {
  if (!puedeReservar(req.user)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para acceder a la reserva de sala.' });
  }

  const { fecha } = req.query;
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ mensaje: 'Debes indicar una fecha válida (YYYY-MM-DD).' });
  }

  try {
    const [bloques] = await pool.query(
      `SELECT Bloque_Horario_Id,
              Bloque_Horario_Hora_Inicio,
              Bloque_Horario_Hora_Fin,
              Bloque_Horario_Tipo,
              Bloque_Horario_Jornada
         FROM bloque_horario
        ORDER BY Bloque_Horario_Hora_Inicio`
    );

    const [reservas] = await pool.query(
      `SELECT r.Reserva_Sala_Id,
              r.Bloque_Horario_Id,
              DATE_FORMAT(r.Reserva_Sala_Fecha, '%Y-%m-%d') AS Reserva_Sala_Fecha,
              r.Usuario_Id,
              u.Usuario_Nombre_Completo
         FROM reserva_sala r
         JOIN usuario u ON u.Usuario_Id = r.Usuario_Id
        WHERE r.Reserva_Sala_Fecha = ?`,
      [fecha]
    );

    const mapaReservas = new Map(reservas.map((r) => [r.Bloque_Horario_Id, r]));

    const bloquesConEstado = bloques.map((b) => {
      const reserva = mapaReservas.get(b.Bloque_Horario_Id) || null;
      return {
        Bloque_Horario_Id: b.Bloque_Horario_Id,
        hora_inicio: formatearHora(b.Bloque_Horario_Hora_Inicio),
        hora_fin: formatearHora(b.Bloque_Horario_Hora_Fin),
        tipo: b.Bloque_Horario_Tipo,
        jornada: b.Bloque_Horario_Jornada,
        ocupado: Boolean(reserva),
        reserva: reserva
          ? {
              Reserva_Sala_Id: reserva.Reserva_Sala_Id,
              Usuario_Id: reserva.Usuario_Id,
              reservado_por: reserva.Usuario_Nombre_Completo,
            }
          : null,
      };
    });

    return res.json({ fecha, bloques: bloquesConEstado });
  } catch (error) {
    console.error('getReservasPorFecha:', error);
    return res.status(500).json({ mensaje: 'No fue posible consultar la disponibilidad de la sala.' });
  }
};

// POST /api/reservas-sala
// Body: { fecha: 'YYYY-MM-DD', bloqueHorarioId: number }
const crearReservaSala = async (req, res) => {
  if (!puedeReservar(req.user)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para reservar la sala multiuso.' });
  }

  const { fecha, bloqueHorarioId } = req.body || {};
  const bloqueId = Number(bloqueHorarioId);

  // Excepción 3 (CU109): validar campos obligatorios y formato
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isInteger(bloqueId) || bloqueId <= 0) {
    return res.status(400).json({ mensaje: 'Debes seleccionar una fecha y un horario válidos.' });
  }

  // Excepción 2 (CU109): no permitir reservas en fechas pasadas
  if (fecha < hoyLocal()) {
    return res.status(400).json({
      mensaje: 'No es posible reservar la sala en una fecha pasada.',
    });
  }

  try {
    // Validar que el bloque exista
    const [bloques] = await pool.query(
      'SELECT Bloque_Horario_Id FROM bloque_horario WHERE Bloque_Horario_Id = ?',
      [bloqueId]
    );
    if (bloques.length === 0) {
      return res.status(404).json({ mensaje: 'El bloque horario seleccionado no existe.' });
    }

    // Excepción 1 (CU109): validar si la hora ya está ocupada
    const [existente] = await pool.query(
      `SELECT Reserva_Sala_Id
         FROM reserva_sala
        WHERE Reserva_Sala_Fecha = ? AND Bloque_Horario_Id = ?`,
      [fecha, bloqueId]
    );
    if (existente.length > 0) {
      return res.status(409).json({
        mensaje: 'La hora seleccionada ya está ocupada. Por favor, elige otro horario.',
      });
    }

    const [resultado] = await pool.query(
      `INSERT INTO reserva_sala (Usuario_Id, Bloque_Horario_Id, Reserva_Sala_Fecha)
       VALUES (?, ?, ?)`,
      [req.user.id, bloqueId, fecha]
    );

    return res.status(201).json({
      mensaje: 'Reserva de sala multiuso registrada correctamente.',
      reserva: {
        Reserva_Sala_Id: resultado.insertId,
        Usuario_Id: req.user.id,
        Bloque_Horario_Id: bloqueId,
        Reserva_Sala_Fecha: fecha,
      },
    });
  } catch (error) {
    // Respaldo ante reservas simultáneas (UNIQUE KEY en BD)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        mensaje: 'La hora seleccionada ya está ocupada. Por favor, elige otro horario.',
      });
    }
    console.error('crearReservaSala:', error);
    return res.status(500).json({ mensaje: 'No fue posible registrar la reserva de la sala.' });
  }
};

module.exports = {
  getReservasPorFecha,
  crearReservaSala,
};