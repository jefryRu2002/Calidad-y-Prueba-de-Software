package com.reparaciones.paginaweb.models;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cotizaciones")
public class CotizacionModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cotizacion")
    private Integer idCotizacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_orden", nullable = false)
    private OrdenTrabajo orden;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_tecnico", nullable = false)
    private TecnicoModel tecnico;

    @Column(name = "estado", nullable = false, length = 30)
    private String estado = "PENDIENTE_ADMIN";

    @Column(name = "total_repuestos", precision = 10, scale = 2)
    private BigDecimal totalRepuestos = BigDecimal.ZERO;

    @Column(name = "mano_obra", precision = 10, scale = 2)
    private BigDecimal manoObra = BigDecimal.ZERO;

    @Column(name = "total", precision = 10, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "notas", columnDefinition = "TEXT")
    private String notas;

    @Column(name = "fecha_creacion")
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_respuesta", nullable = true)
    private LocalDateTime fechaRespuesta;

    @OneToMany(mappedBy = "cotizacion", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @JsonIgnoreProperties("cotizacion")
    private List<CotizacionRepuestoModel> repuestos = new ArrayList<>();

    @OneToMany(mappedBy = "cotizacion", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @JsonIgnoreProperties("cotizacion")
    private List<CotizacionTrabajoModel> trabajos = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.fechaCreacion = LocalDateTime.now();
        if (this.estado == null) this.estado = "PENDIENTE_ADMIN";
    }

    // Getters y Setters
    public Integer getIdCotizacion() { return idCotizacion; }
    public void setIdCotizacion(Integer idCotizacion) { this.idCotizacion = idCotizacion; }

    public OrdenTrabajo getOrden() { return orden; }
    public void setOrden(OrdenTrabajo orden) { this.orden = orden; }

    public TecnicoModel getTecnico() { return tecnico; }
    public void setTecnico(TecnicoModel tecnico) { this.tecnico = tecnico; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public BigDecimal getTotalRepuestos() { return totalRepuestos; }
    public void setTotalRepuestos(BigDecimal totalRepuestos) { this.totalRepuestos = totalRepuestos; }

    public BigDecimal getManoObra() { return manoObra; }
    public void setManoObra(BigDecimal manoObra) { this.manoObra = manoObra; }

    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }

    public String getNotas() { return notas; }
    public void setNotas(String notas) { this.notas = notas; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }

    public LocalDateTime getFechaRespuesta() { return fechaRespuesta; }
    public void setFechaRespuesta(LocalDateTime fechaRespuesta) { this.fechaRespuesta = fechaRespuesta; }

    public List<CotizacionRepuestoModel> getRepuestos() { return repuestos; }
    public void setRepuestos(List<CotizacionRepuestoModel> repuestos) { this.repuestos = repuestos; }

    public List<CotizacionTrabajoModel> getTrabajos() { return trabajos; }
    public void setTrabajos(List<CotizacionTrabajoModel> trabajos) { this.trabajos = trabajos; }
}