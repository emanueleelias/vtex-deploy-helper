# VTEX Deploy Helper

---

[![npm version](https://badge.fury.io/js/vtex-deploy-helper.svg)](https://badge.fury.io/js/vtex-deploy-helper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**vtex-deploy-helper** es una librería de Node.js que proporciona una interfaz de línea de comandos (CLI) para facilitar el despliegue de aplicaciones en VTEX IO. Con este paquete, puedes automatizar y simplificar los procesos de despliegue, incluyendo la publicación de aplicaciones, la actualización de versiones y la migración de los ids de site editor si estas realizando una major.

---

### **Características Principales**

- **Automatización de Despliegues**: Ejecuta comandos de VTEX IO de manera secuencial y automatizada.
- **Soporte para Múltiples Tipos de Despliegue**:
  - **Patch Stable**: Despliegue de parches menores.
  - **Major Stable**: Despliegue de versiones mayores con migración de CMS.
  - **Despliegue de nueva custom app**: Despliegue de una nueva custom app.
  - **Actualización de custom app**: Actualización de una custom app existente.
- **Interfaz de Línea de Comandos (CLI)**: Interfaz amigable para guiar al usuario a través del proceso de despliegue.
- **Verificaciones Previas**: Asegura que el directorio de trabajo y la versión del manifest sean correctos antes de iniciar el despliegue, en caso de custom apps.
- **Feedback en Tiempo Real**: Proporciona mensajes de estado y errores durante el proceso de despliegue.

---

### **Instalación**

Para instalar `vtex-deploy-helper` globalmente en tu sistema, ejecuta el siguiente comando en tu terminal:

```bash
npm install -g vtex-deploy-helper
```

Esto te permitirá utilizar el comando `vdeploy` desde cualquier lugar en tu sistema.

### **Uso del Comando `vdeploy`**

El comando `vdeploy` es la interfaz principal para interactuar con la librería. Puedes usarlo en modo interactivo (menú guiado clásico) o mediante subcomandos directos.

#### **Modo Interactivo (Por Defecto)**

Si ejecutas `vdeploy` sin argumentos, se abrirá un menú interactivo:

```bash
$ vdeploy
🚀 Iniciando proceso de deploy VTEX IO
? ¿Qué tipo de despliegue quieres realizar? Release patch stable
Configuración seleccionada:
• Tipo de deploy: PATCH_STABLE
🔍 Verificando custom app...
...
✅ Patch stable completado exitosamente
```

#### **Subcomandos Directos**

Para mayor velocidad e integraciones en CI/CD o scripts, puedes ejecutar directamente el tipo de despliegue deseado mediante subcomandos:

- `vdeploy patch` — Despliegue de parches menores (`PATCH_STABLE`).
- `vdeploy major` — Despliegue de versiones mayores con migración automática orientada desde `manifest.json`. (`MAJOR_STABLE`).
- `vdeploy publish` — Para publicar una nueva custom app (`NEW_CUSTOM_APP`).
- `vdeploy update` — Para actualizar una custom app existente (`UPDATE_CUSTOM_APP`).

#### **Opciones Disponibles**

- `--dry-run`: Puedes agregar esta opción a cualquier comando para que el CLI simule el proceso y muestre en pantalla **exactamente qué comandos se ejecutarían**, sin ejecutar nada. Ideal para verificar antes de actuar en producción.

```bash
# Ejemplo: testear qué pasará al hacer un update
$ vdeploy update --dry-run
```

- `--help` (`-h`): Visualiza la ayuda del CLI y los comandos disponibles.
- `--version` (`-V`): Imprime la versión actual de la librería en tu sistema.

#### **Logs de Auditoría**

Por cada corrida, la librería genera de manera automática un archivo de logs local (ej. `vdeploy-YYYY-MM-DDTHH-mm-ss.log`) en tu directorio actual. Este log te permite inspeccionar todo lo que el sistema ejecutó, así como posibles errores silenciosos.

---

### **Configuración Adicional**

No se requiere configuración adicional para utilizar `vtex-deploy-helper`. Sin embargo, asegúrate de tener instalado y configurado correctamente el CLI de VTEX en tu sistema.

---

### **Contribución**

¡Si queres contribuir con `vtex-deploy-helper`! por favor seguí estos pasos:

1. **Fork** el repositorio.
2. **Crea una rama** para tu nueva funcionalidad (`git checkout -b feature/nueva-funcionalidad`).
3. **Commitea tus cambios** (`git commit -am 'Añadir nueva funcionalidad'`).
4. **Sube tus cambios** (`git push origin feature/nueva-funcionalidad`).
5. **Abre un Pull Request**.

---

### **Licencia**

Este proyecto está licenciado bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

### **Contacto**

Si tienes alguna pregunta o sugerencia, no dudes en abrir un issue en el repositorio de GitHub o contactarme directamente.

- **GitHub**: [Repositorio de vtex-deploy-helper](https://github.com/emanueleelias/vtex-deploy-helper)
- **Correo Electrónico**: <emanueleeliasdaniel@gmail.com>

---

¡Gracias por utilizar `vtex-deploy-helper`! Espero que esta herramienta te ayude a simplificar tus procesos de despliegue en VTEX IO.
