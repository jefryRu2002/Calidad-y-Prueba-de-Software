package com.reparaciones.paginaweb.repositories;

import com.reparaciones.paginaweb.models.CotizacionModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CotizacionRepository extends JpaRepository<CotizacionModel, Integer> {

    @Query("SELECT c FROM CotizacionModel c WHERE c.orden.idOrden = :idOrden")
    List<CotizacionModel> findByIdOrden(@Param("idOrden") Integer idOrden);

    @Query("SELECT c FROM CotizacionModel c WHERE c.tecnico.idPersona = :idTecnico")
    List<CotizacionModel> findByIdTecnico(@Param("idTecnico") Integer idTecnico);

    List<CotizacionModel> findByEstado(String estado);
}