import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  usuario: string = '';
  contrasena: string = '';
  cargando: boolean = false;
  errorLogin: string = '';
  cuentaCreada: boolean = false;

  mostrarOlvido: boolean = false;
  correoRecuperacion: string = '';
  enviandoCorreo: boolean = false;
  correoEnviado: boolean = false;

  mostrarRegistro: boolean = false;
  dni: string = '';
  nombres: string = '';
  apellidos: string = '';
  correo: string = '';
  telefono: string = '';
  fechaNacimiento: string = '';
  contrasenaRegistro: string = '';
  confirmarContrasena: string = '';
  errorRegistro: string = '';
  buscandoDni: boolean = false;
  registrando: boolean = false;

  private timeoutErrorLogin: any;
  private timeoutErrorRegistro: any;

  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  // ==================== HELPERS DE ERROR (auto-limpieza a los 3s) ====================
  private mostrarErrorLogin(mensaje: string) {
    if (this.timeoutErrorLogin) clearTimeout(this.timeoutErrorLogin);
    this.errorLogin = mensaje;
    this.cdr.detectChanges();
    this.timeoutErrorLogin = setTimeout(() => {
      this.errorLogin = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  private mostrarErrorRegistro(mensaje: string) {
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    this.errorRegistro = mensaje;
    this.cdr.detectChanges();
    this.timeoutErrorRegistro = setTimeout(() => {
      this.errorRegistro = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  // ==================== CALENDARIO (bloquear teclado en fecha) ====================
  abrirCalendario(event: Event) {
    const input = event.target as HTMLInputElement;
    // Abre el selector de fecha nativo (Chrome, Edge, Opera)
    // En navegadores que no lo soportan, simplemente no hace nada
    input.showPicker?.();
  }

  // ==================== INICIAR SESIÓN ====================
  iniciarSesion() {
    if (!this.usuario || !this.contrasena) {
      this.mostrarErrorLogin('Ingresa usuario y contraseña');
      return;
    }

    this.cargando = true;
    this.errorLogin = '';
    this.cdr.detectChanges();

    this.http.post(`${this.apiUrl}/auth/login`, {
      usuario: this.usuario.trim(),
      contrasena: this.contrasena
    }).subscribe({
      next: (resp: any) => {
        const usuarioData = {
          idPersona: resp.idPersona || '',
          nombre: resp.nombre || '',
          apellido: resp.apellido || '',
          correo: resp.correo || this.usuario,
          telefono: resp.telefono || '',
          dni: resp.dni || '',
          rol: resp.rol?.toUpperCase() || 'CLIENTE'
        };

        localStorage.setItem('usuario', JSON.stringify(usuarioData));
        localStorage.setItem('idPersona', usuarioData.idPersona.toString());
        if (resp.token) localStorage.setItem('token', resp.token);

        this.cargando = false;
        this.cdr.detectChanges();
        this.redirigirPorRol(resp.rol);
      },
      error: (err) => {
        this.cargando = false;
        this.cdr.detectChanges();

        if (err.status === 401 || err.status === 403) {
          this.mostrarErrorLogin('Credenciales incorrectas');
        } else if (err.status === 0) {
          this.mostrarErrorLogin('No se pudo conectar al servidor');
        } else {
          this.mostrarErrorLogin(err.error?.error || 'Error al iniciar sesión');
        }
      }
    });
  }

  private redirigirPorRol(rol: string) {
    const r = rol?.toUpperCase();
    console.log('>>> Redirigiendo por rol:', r);

    switch (r) {
      case 'ADMINISTRADOR':
      case 'ADMIN':
        this.router.navigate(['/administrador/dashboard']);
        break;
      case 'TECNICO':
      case 'TÉCNICO':
        this.router.navigate(['/tecnico/ordenes-asignadas']);
        break;
      default:
        this.router.navigate(['/cliente/dashboard']);
        break;
    }
  }

  // ==================== OLVIDO CONTRASEÑA ====================
  abrirOlvido() {
    if (this.timeoutErrorLogin) clearTimeout(this.timeoutErrorLogin);
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    this.errorLogin = '';
    this.errorRegistro = '';
    this.mostrarOlvido = true;
    this.correoEnviado = false;
    this.correoRecuperacion = '';
  }

  cerrarOlvido() {
    this.mostrarOlvido = false;
  }

  enviarCorreoRecuperacion() {
    if (!this.correoRecuperacion) return;
    this.enviandoCorreo = true;
    this.cdr.detectChanges();

    this.http.post(`${this.apiUrl}/auth/olvide-contrasena`, {
      correo: this.correoRecuperacion.trim()
    }).subscribe({
      next: () => {
        this.enviandoCorreo = false;
        this.correoEnviado = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.enviandoCorreo = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== REGISTRO ====================
  abrirRegistro() {
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    if (this.timeoutErrorLogin) clearTimeout(this.timeoutErrorLogin);
    this.errorRegistro = '';
    this.errorLogin = '';

    this.mostrarRegistro = true;
    this.dni = '';
    this.nombres = '';
    this.apellidos = '';
    this.correo = '';
    this.telefono = '';
    this.fechaNacimiento = '';
    this.contrasenaRegistro = '';
    this.confirmarContrasena = '';
    this.registrando = false;
    this.cdr.detectChanges();
  }

  cerrarRegistro() {
    if (this.timeoutErrorRegistro) clearTimeout(this.timeoutErrorRegistro);
    this.mostrarRegistro = false;
    this.errorRegistro = '';
    this.registrando = false;
  }

  onDniChange() {
    this.nombres = '';
    this.apellidos = '';
    this.fechaNacimiento = '';
    if (this.dni.length === 8) {
      this.buscarDniReniec();
    }
  }

  buscarDniReniec() {
    if (!this.dni || this.dni.length !== 8) return;
    this.buscandoDni = true;
    this.cdr.detectChanges();

    this.http.get(`${this.apiUrl}/reniec/dni/${this.dni}`).subscribe({
      next: (resp: any) => {
        const data = resp.data || resp;
        if (data) {
          this.nombres = data.nombres || data.nombre || '';
          const paterno = data.apellidoPaterno || data.apellido_paterno || data.paterno || '';
          const materno = data.apellidoMaterno || data.apellido_materno || data.materno || '';
          this.apellidos = (paterno + ' ' + materno).trim() || data.apellidos || data.apellido || '';
          this.fechaNacimiento = data.fechaNacimiento || data.fecha_nacimiento || '';
        }
        this.buscandoDni = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.buscandoDni = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Validar solo números en teléfono
  soloNumeros(event: any): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

  // Solo permite dígitos en el DNI (máx 8)
  onDniInput(event: any) {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '').slice(0, 8);
    this.dni = valor;
    input.value = valor;
    this.onDniChange();
  }

  // Solo permite dígitos en el teléfono (máx 9)
  onTelefonoInput(event: any) {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '').slice(0, 9);
    this.telefono = valor;
    input.value = valor;
  }

  // ==================== REGISTRAR ====================
  registrarUsuario() {
    this.errorRegistro = '';

    // Validaciones
    if (!this.dni || this.dni.length !== 8) {
      this.mostrarErrorRegistro('DNI inválido (8 dígitos)');
      return;
    }
    if (!this.nombres.trim()) {
      this.mostrarErrorRegistro('Ingresa tus nombres');
      return;
    }
    if (!this.apellidos.trim()) {
      this.mostrarErrorRegistro('Ingresa tus apellidos');
      return;
    }
    if (!this.fechaNacimiento) {
      this.mostrarErrorRegistro('Debes ingresar tu fecha de nacimiento');
      return;
    }
    if (!this.correo?.includes('@')) {
      this.mostrarErrorRegistro('Correo inválido');
      return;
    }
    if (!this.telefono || this.telefono.length !== 9) {
      this.mostrarErrorRegistro('Teléfono inválido (debe tener 9 dígitos)');
      return;
    }
    if (!/^\d{9}$/.test(this.telefono)) {
      this.mostrarErrorRegistro('Teléfono inválido (solo números, 9 dígitos)');
      return;
    }
    if (this.contrasenaRegistro.length < 6) {
      this.mostrarErrorRegistro('Contraseña muy corta (mín 6)');
      return;
    }
    if (this.contrasenaRegistro !== this.confirmarContrasena) {
      this.mostrarErrorRegistro('Las contraseñas no coinciden');
      return;
    }

    this.registrando = true;
    this.errorRegistro = '';
    this.cdr.detectChanges();

    const body = {
      dni: this.dni.trim(),
      nombre: this.nombres.trim(),
      apellido: this.apellidos.trim(),
      telefono: this.telefono.trim(),
      usuario: this.correo.trim().toLowerCase(),
      contrasena: this.contrasenaRegistro,
      fechaNacimiento: this.fechaNacimiento
    };

    console.log('📤 Registrando CLIENTE:', body);

    this.http.post(`${this.apiUrl}/auth/register`, body).subscribe({
      next: (resp: any) => {
        console.log('✅ Registro exitoso:', resp);
        this.registrando = false;
        this.cerrarRegistro();
        this.cuentaCreada = true;
        this.usuario = this.correo.trim().toLowerCase();
        this.cdr.detectChanges();

        setTimeout(() => {
          this.cuentaCreada = false;
          this.cdr.detectChanges();
        }, 5000);
      },
      error: (err) => {
        this.registrando = false;
        console.error('❌ Error registro:', err);

        if (err.status === 409) {
          this.mostrarErrorRegistro(err.error?.error || 'El correo ya está registrado');
        } else if (err.status === 400) {
          this.mostrarErrorRegistro(err.error?.error || 'Datos inválidos');
        } else if (err.status === 0) {
          this.mostrarErrorRegistro('No se pudo conectar al servidor');
        } else {
          this.mostrarErrorRegistro(err.error?.error || 'Error al crear la cuenta');
        }
      }
    });
  }
}