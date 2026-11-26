import { useEffect, useState } from "react";
import { getReservasSala, crearReservaSala } from "../../services/api";

function fechaHoy() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ReservaSala() {
  const [fecha, setFecha] = useState(fechaHoy());
  const [bloques, setBloques] = useState([]);
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const data = await getReservasSala(fecha);
        if (activo && data?.bloques) {
          setBloques(data.bloques);
        }
      } catch (err) {
        if (activo) {
          setMensajeError(err.message || "No fue posible cargar la disponibilidad.");
          setBloques([]);
        }
      } finally {
        if (activo) setCargando(false);
      }
    };

    if (fecha) cargar();
    return () => {
      activo = false;
    };
  }, [fecha]);

  const handleCambioFecha = (e) => {
    setFecha(e.target.value);
    setBloqueSeleccionado("");
    setMensajeExito("");
    setMensajeError("");
    setCargando(true);
  };

  const handleReservar = async (e) => {
    e.preventDefault();
    setMensajeExito("");
    setMensajeError("");

    if (!fecha || !bloqueSeleccionado) {
      setMensajeError("Debes seleccionar una fecha y un bloque horario.");
      return;
    }

    setEnviando(true);
    try {
      const resp = await crearReservaSala({
        fecha,
        bloqueHorarioId: bloqueSeleccionado,
      });
      setMensajeExito(resp?.mensaje || "Reserva de sala multiuso registrada correctamente.");
      setBloqueSeleccionado("");

      // Recargar tabla para reflejar el bloque recién reservado
      const data = await getReservasSala(fecha);
      if (data?.bloques) {
        setBloques(data.bloques);
      }
    } catch (err) {
      // Excepción 1: el horario ya está ocupado (409) u otro error controlado
      setMensajeError(err.message || "No fue posible registrar la reserva.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Reserva de Sala Multiuso</h1>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Selecciona una fecha y un bloque horario disponible para reservar la sala multiuso.
      </p>

      {mensajeExito && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "6px",
            backgroundColor: "#e6f4ea",
            color: "#1e7e34",
            border: "1px solid #b7dfbf",
          }}
        >
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "6px",
            backgroundColor: "#fdecea",
            color: "#b71c1c",
            border: "1px solid #f5c6cb",
          }}
        >
          {mensajeError}
        </div>
      )}

      <form
        onSubmit={handleReservar}
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: "24px",
          padding: "16px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          backgroundColor: "#fff",
        }}
      >
        <div>
          <label htmlFor="fecha-reserva" style={{ display: "block", fontWeight: "600", marginBottom: "6px" }}>
            Fecha
          </label>
          <input
            id="fecha-reserva"
            type="date"
            min={fechaHoy()}
            value={fecha}
            onChange={handleCambioFecha}
            required
            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
        </div>

        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor="bloque-reserva" style={{ display: "block", fontWeight: "600", marginBottom: "6px" }}>
            Bloque Horario
          </label>
          <select
            id="bloque-reserva"
            value={bloqueSeleccionado}
            onChange={(e) => setBloqueSeleccionado(e.target.value)}
            required
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc" }}
          >
            <option value="">-- Selecciona un horario --</option>
            {bloques.map((b) => (
              <option key={b.Bloque_Horario_Id} value={b.Bloque_Horario_Id}>
                {b.hora_inicio} - {b.hora_fin} ({b.jornada}){b.ocupado ? " — OCUPADO" : " — Disponible"}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={enviando || cargando}
          style={{
            padding: "10px 20px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "#1976d2",
            color: "#fff",
            fontWeight: "600",
            cursor: enviando ? "not-allowed" : "pointer",
          }}
        >
          {enviando ? "Reservando..." : "Reservar Sala"}
        </button>
      </form>

      <h2 style={{ marginBottom: "12px" }}>Disponibilidad para el {fecha}</h2>

      {cargando ? (
        <p>Cargando bloques horarios...</p>
      ) : bloques.length === 0 ? (
        <p>No hay bloques horarios registrados.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff" }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Horario</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Jornada</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Estado</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Reservado por</th>
            </tr>
          </thead>
          <tbody>
            {bloques.map((b) => (
              <tr key={b.Bloque_Horario_Id}>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                  {b.hora_inicio} - {b.hora_fin}
                </td>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>{b.jornada}</td>
                <td
                  style={{
                    padding: "10px",
                    border: "1px solid #ddd",
                    fontWeight: "600",
                    color: b.ocupado ? "#b71c1c" : "#1e7e34",
                  }}
                >
                  {b.ocupado ? "Ocupado" : "Disponible"}
                </td>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                  {b.reserva ? b.reserva.reservado_por : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ReservaSala;