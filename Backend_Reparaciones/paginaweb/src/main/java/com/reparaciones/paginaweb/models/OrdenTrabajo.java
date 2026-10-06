package com.reparaciones.paginaweb.models;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orden_trabajo")
public class OrdenTrabajo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_orden")
    private Integer idOrden;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_reporte")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ReporteFallaModel reporte;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_equipo")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private EquipoModel equipo;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_tecnico", nullable = true)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private TecnicoModel tecnico;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin", nullable = true)
    private LocalDate fechaFin;

    @Column(name = "fecha_asignacion", nullable = true)
    private LocalDateTime fechaAsignacion;

    @Column(name = "estado", nullable = false, length = 40)
    private String estado = "PENDIENTE";

    @Column(name = "puede_pagar", nullable = false)
    private Boolean puedePagar = false;

    @Column(name = "notas_tecnico", columnDefinition = "TEXT")
    private String notasTecnico;

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @JsonIgnoreProperties("orden")
    private List<ReparacionTrabajoModel> trabajosRealizados = new ArrayList<>();

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @JsonIgnoreProperties("orden")
    private List<ReparacionRepuestoModel> repuestosUsados = new ArrayList<>();

    // ==================== NUEVOS CAMPOS DE FLUJO ====================
    // idCotizacion se maneja por relación en cotizaciones.id_orden
    // idReparacion se elimina (era campo fantasma)

    public OrdenTrabajo() {}

    // Getters y Setters
    public Integer getIdOrden() { return idOrden; }
    public void setIdOrden(Integer idOrden) { this.idOrden = idOrden; }

    public ReporteFallaModel getReporte() { return reporte; }
    public void setReporte(ReporteFallaModel reporte) { this.reporte = reporte; }

    public EquipoModel getEquipo() { return equipo; }
    public void setEquipo(EquipoModel equipo) { this.equipo = equipo; }

    public TecnicoModel getTecnico() { return tecnico; }
    public void setTecnico(TecnicoModel tecnico) { this.tecnico = tecnico; }

    public LocalDate getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(LocalDate fechaInicio) { this.fechaInicio = fechaInicio; }

    public LocalDate getFechaFin() { return fechaFin; }
    public void setFechaFin(LocalDate fechaFin) { this.fechaFin = fechaFin; }

    public LocalDateTime getFechaAsignacion() { return fechaAsignacion; }
    public void setFechaAsignacion(LocalDateTime fechaAsignacion) { this.fechaAsignacion = fechaAsignacion; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public Boolean getPuedePagar() { return puedePagar; }
    public void setPuedePagar(Boolean puedePagar) { this.puedePagar = puedePagar; }

    public String getNotasTecnico() { return notasTecnico; }
    public void setNotasTecnico(String notasTecnico) { this.notasTecnico = notasTecnico; }

    public List<ReparacionTrabajoModel> getTrabajosRealizados() { return trabajosRealizados; }
    public void setTrabajosRealizados(List<ReparacionTrabajoModel> trabajosRealizados) { this.trabajosRealizados = trabajosRealizados; }

    public List<ReparacionRepuestoModel> getRepuestosUsados() { return repuestosUsados; }
    public void setRepuestosUsados(List<ReparacionRepuestoModel> repuestosUsados) { this.repuestosUsados = repuestosUsados; }
}