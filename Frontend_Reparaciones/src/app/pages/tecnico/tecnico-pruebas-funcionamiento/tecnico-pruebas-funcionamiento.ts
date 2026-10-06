import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface Prueba {
  id: number;
  nombre: string;
  resultado: 'pendiente' | 'ok' | 'falla';
}

@Component({
  selector: 'app-pruebas-funcionamiento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tecnico-pruebas-funcionamiento.html',
  styleUrls: ['./tecnico-pruebas-funcionamiento.css']
})
export class TecnicoPruebasFuncionamiento implements OnInit {

  ordenes: any[] = [];
  ordenSeleccionada: any = null;
  observaciones = '';
  error = '';
  exito = '';
  cargando = true;
  procesando = false;
  
  pruebas: Prueba[] = [
    { id: 1, nombre: 'Encendido y arranque', resultado: 'pendiente' },
    { id: 2, nombre: 'Funcionamiento de pantalla', resultado: 'pendiente' },
    { id: 3, nombre: 'Conectividad WiFi', resultado: 'pendiente' },
    { id: 4, nombre: 'Puertos USB / carga', resultado: 'pendiente' },
    { id: 5, nombre: 'Batería y autonomía', resultado: 'pendiente' },
    { id: 6, nombre: 'Rendimiento general', resultado: 'pendiente' },
    { id: 7, nombre: 'Cámara', resultado: 'pendiente' },
    { id: 8, nombre: 'Audio y micrófono', resultado: 'pendiente' },
  ];

  private apiUrl = 'http://localhost:8080/api';
  idTecnico = 0;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.idTecnico = Number(usuario.idPersona) || 0;
    
    if (this.idTecnico > 0) {
      this.cargarOrdenes();
    } else {
      this.cargando = false;
      this.error = '❌ No se pudo identificar al técnico';
      this.cdr.detectChanges();
    }
  }

  cargarOrdenes(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (data) => {
        // Solo órdenes del técnico en estado EN_PRUEBAS
        const delTecnico = (data || []).filter(ot => {
          const idTecnicoOrden = Number(ot.idTecnico || ot.id_tecnico || 0);
          return idTecnicoOrden === this.idTecnico && ot.estado === 'EN_PRUEBAS';
        });

        this.ordenes = delTecnico.map(ot => ({
          id: ot.idOrden,
          ticket: 'OT-' + ot.idOrden,
          equipo: `${ot.marca || ''} ${ot.modelo || ''}`.trim(),
          cliente: ot.nombreCliente || 'Sin cliente',
          descripcion: ot.descripcion || ot.descripcionFalla || '',
          estado: ot.estado,
          fechaInicio: ot.fechaInicio || ''
        }));

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ Error al cargar órdenes.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  seleccionarOrden(orden: any): void {
    this.ordenSeleccionada = orden;
    this.resetearPruebas();
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.ordenSeleccionada = null;
    this.resetearPruebas();
    this.cdr.detectChanges();
  }

  setResultado(id: number, resultado: Prueba['resultado']): void {
    this.pruebas = this.pruebas.map(p => p.id === id ? { ...p, resultado } : p);
    this.cdr.detectChanges();
  }

  resetearPruebas(): void {
    this.pruebas = this.pruebas.map(p => ({ ...p, resultado: 'pendiente' as const }));
    this.observaciones = '';
    this.error = '';
    this.exito = '';
  }

  get todasCompletadas(): boolean { 
    return this.pruebas.every(p => p.resultado !== 'pendiente'); 
  }
  
  get hayFallas(): boolean { 
    return this.pruebas.some(p => p.resultado === 'falla'); 
  }
  
  get pruebasOk(): number { 
    return this.pruebas.filter(p => p.resultado === 'ok').length; 
  }
  
  get pruebasFalla(): number { 
    return this.pruebas.filter(p => p.resultado === 'falla').length; 
  }

  guardar(): void {
    if (!this.ordenSeleccionada) {
      this.error = '❌ Selecciona una orden primero.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.todasCompletadas) {
      this.error = '❌ Completa todas las pruebas antes de guardar.';
      this.cdr.detectChanges();
      return;
    }

    this.procesando = true;
    this.error = '';
    this.cdr.detectChanges();

    // Si hay fallas → vuelve a reparación
    // Si todo OK → terminar
    const endpoint = this.hayFallas ? 'volver-reparacion' : 'terminar';

    this.http.put(`${this.apiUrl}/ordenes-trabajo/${this.ordenSeleccionada.id}/${endpoint}`, {}).subscribe({
      next: () => {
        if (this.hayFallas) {
          this.exito = '⚠️ Se detectaron fallas. El equipo vuelve a reparación.';
        } else {
          this.exito = '✅ ¡Todas las pruebas pasaron! Equipo listo para entrega. Pago habilitado.';
        }
        this.procesando = false;
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.exito = '';
          this.ordenSeleccionada = null;
          this.resetearPruebas();
          this.cargarOrdenes();
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        console.error('❌ Error al guardar:', err);
        this.error = '❌ Error al guardar las pruebas. Intente nuevamente.';
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.error = ''; this.cdr.detectChanges(); }, 5000);
      }
    });
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    try {
      return new Date(fecha).toLocaleDateString('es-PE', { 
        day: '2-digit', month: '2-digit', year: 'numeric' 
      });
    } catch {
      return fecha;
    }
  }

  recargar(): void {
    this.ordenSeleccionada = null;
    this.resetearPruebas();
    this.cargarOrdenes();
  }
}