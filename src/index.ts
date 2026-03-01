import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { existsSync } from 'fs';
import path from 'path';
import * as fs from 'fs';

interface DeployStep {
  emoji: string;
  label: string;
  command: string;
}

function createLogger() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(process.cwd(), `vdeploy-${timestamp}.log`);

  return (message: string) => {
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`, 'utf8');
  };
}


interface ManifestData {
  vendor: string;
  name: string;
  version: string;
}

const execAsync = promisify(exec);

async function execCommandAsync(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.log(chalk.yellow('Advertencia:'), stderr);
    }
    return stdout;
  } catch (error) {
    console.error(chalk.red(`Error ejecutando comando: ${command}`));
    throw error;
  }
}

function execCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Separamos el comando y sus argumentos
    const [cmd, ...args] = command.split(' ');

    // Creamos el proceso con stdio heredado para permitir interacción
    const childProcess = spawn(cmd, args, {
      stdio: 'inherit', // Esto permite la interacción directa con el proceso
      shell: true
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Helper para hacer delay entre comandos si es necesario
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type DeployType = 'PATCH_STABLE' | 'NEW_CUSTOM_APP' | 'UPDATE_CUSTOM_APP' | 'MAJOR_STABLE';

export interface DeployOptions {
  deployType?: DeployType;
  dryRun?: boolean;
}

export class VtexDeploy {
  private deployType: DeployType;
  private vendor: string = '';
  private dryRun: boolean;
  private log: (msg: string) => void;

  constructor(options: DeployOptions = {}) {
    this.deployType = options.deployType || 'PATCH_STABLE';
    this.dryRun = options.dryRun || false;
    this.log = createLogger();
    this.setupSignalHandlers();
  }

  private setupSignalHandlers() {
    process.on('SIGINT', () => {
      console.log(chalk.red('\n\n⚠️  Proceso cancelado (SIGINT).'));
      console.log(chalk.yellow('El workspace y configuración pueden estar en un estado inconsistente. Revisa VTEX IO manualmente.'));
      this.log('ERROR: Proceso cancelado por el usuario (SIGINT)');
      process.exit(1);
    });
  }

  private async runPipeline(steps: DeployStep[]): Promise<void> {
    for (const step of steps) {
      const msg = `\n${step.emoji} ${step.label} - (${step.command})...`;
      console.log(chalk.yellow(msg));
      this.log(`RUNNING: ${step.command}`);

      if (this.dryRun) {
        console.log(chalk.gray('  [dry-run] Comando omitido'));
        this.log(`DRY-RUN SKIPPED: ${step.command}`);
        continue;
      }

      try {
        await execCommand(step.command);
        this.log(`SUCCESS: ${step.command}`);
      } catch (error: any) {
        this.log(`FAILED: ${step.command} - Error: ${error.message}`);
        throw error;
      }
    }
  }

  private async promptForVendor(): Promise<void> {
    const { vendor } = await inquirer.prompt([{
      type: 'input',
      name: 'vendor',
      message: '¿Cuál es el vendor?',
      validate: (input) => input.length > 0 || 'El vendor es requerido'
    }]);
    this.vendor = vendor;
  }


  private async readManifest(): Promise<ManifestData> {
    try {
      // Obtener el directorio actual
      const currentDir = process.cwd();
      const manifestPath = path.join(currentDir, 'manifest.json');

      // Verificar si existe el archivo
      if (!fs.existsSync(manifestPath)) {
        throw new Error('No se encontró el archivo manifest.json en el directorio actual. Asegúrate de estar en el directorio raíz del proyecto.');
      }

      // Leer y parsear el manifest.json
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: ManifestData = JSON.parse(manifestContent);

      // Validar que exista el vendor
      if (!manifest.vendor) {
        throw new Error('No se encontró el campo "vendor" en el manifest.json');
      }

      return manifest;
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('\n❌ Error al leer el manifest.json:'), error.message);
      }
      throw error;
    }
  }

  private async getVendorFromManifest(): Promise<string> {
    const manifest = await this.readManifest();
    return manifest.vendor;
  }

  private async getThemeVersions(): Promise<{ from: string; to: string }> {
    const manifest = await this.readManifest();
    const versionMatch = manifest.version.match(/^(\d+)\./);
    if (!versionMatch) {
      throw new Error(`Formato de versión inválido en manifest.json: ${manifest.version}`);
    }
    const currentMajor = parseInt(versionMatch[1], 10);
    return {
      from: `${manifest.vendor}.store@${currentMajor}.x`,
      to: `${manifest.vendor}.store@${currentMajor + 1}.x`
    };
  }

  private async checkCustomAppDirectory(): Promise<boolean> {
    const { isInDirectory } = await inquirer.prompt([{
      type: 'confirm',
      name: 'isInDirectory',
      message: '¿Estás dentro del directorio de la custom app?',
      default: false
    }]);

    if (!isInDirectory) {
      console.log(chalk.yellow('⚠️ Por favor, posiciónate dentro del directorio de la custom app y vuelve a ejecutar el script.'));
      return false;
    }

    // Verificar si existe el manifest.json
    if (!existsSync('./manifest.json')) {
      console.log(chalk.red('❌ No se encontró el archivo manifest.json. Asegúrate de estar en el directorio correcto.'));
      return false;
    }

    return true;
  }

  private async checkVersionUpdate(): Promise<boolean> {
    const { versionUpdated } = await inquirer.prompt([{
      type: 'confirm',
      name: 'versionUpdated',
      message: '¿Has actualizado la versión en el manifest.json y subido los cambios al repositorio?',
      default: false
    }]);

    if (!versionUpdated) {
      console.log(chalk.yellow('⚠️ Debes actualizar la versión en el manifest.json y subir los cambios antes de continuar.'));
      return false;
    }

    return true;
  }

  private async promptForMigrationContinuation(): Promise<boolean> {
    const { continueDeploy } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueDeploy',
      message: '¿Desea continuar con la promoción del workspace de production a master?',
      default: false
    }]);

    return continueDeploy;
  }

  private async executePatchStable(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));
      this.log(`Iniciando PATCH_STABLE para vendor: ${this.vendor}`);

      try {
        const steps: DeployStep[] = [
          { emoji: '👤', label: 'Iniciando sesión en VTEX', command: `vtex login ${this.vendor}` },
          { emoji: '🧹', label: 'Eliminando/limpiando workspace de producción si existe', command: 'vtex workspace delete production' },
          { emoji: '🔄', label: 'Cambiando a workspace production', command: 'vtex use production --production' },
          { emoji: '📤', label: 'Ejecutando release patch stable', command: 'vtex release patch stable' },
          { emoji: '🔨', label: 'Ejecutando deploy force', command: 'vtex deploy --force' },
          { emoji: '💾', label: 'Actualizando workspace de producción', command: 'vtex update' }
        ];

        await this.runPipeline(steps);

        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.cyan('\n🌐 Por favor, verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        if (!this.dryRun) {
          const { continuar } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continuar',
            message: '¿Los cambios están correctos y deseas continuar con el proceso?',
            default: false,
          }]);

          if (!continuar) {
            console.log(chalk.yellow('\nProceso cancelado por el usuario'));
            this.log('Proceso cancelado por el usuario tras verificación en production');
            return;
          }
        }

        const finalSteps: DeployStep[] = [
          { emoji: '🔄', label: 'Cambiando a workspace master', command: 'vtex use master' },
          { emoji: '💾', label: 'Actualizando workspace master', command: 'vtex update' }
        ];
        await this.runPipeline(finalSteps);

        console.log(chalk.green('\n✅ Patch stable completado exitosamente 🚀'));
        this.log('Patch stable completado exitosamente');
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante el patch stable'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en patch stable:'), error);
      throw error;
    }
  }

  private async executeNewCustomApp(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));
      this.log(`Iniciando NEW_CUSTOM_APP para vendor: ${this.vendor}`);

      console.log(chalk.blue('\n🔍 Verificando custom app...'));
      if (!await this.checkCustomAppDirectory()) {
        throw new Error('Directorio incorrecto para custom app');
      }

      try {
        const steps: DeployStep[] = [
          { emoji: '👤', label: 'Iniciando sesión en VTEX', command: `vtex login ${this.vendor}` },
          { emoji: '🧹', label: 'Eliminando/limpiando workspace de producción si existe', command: 'vtex workspace delete production' },
          { emoji: '🔄', label: 'Cambiando a workspace production', command: 'vtex use production --production' },
          { emoji: '📦', label: 'Publicando app', command: 'vtex publish' },
          { emoji: '🔨', label: 'Ejecutando deploy force', command: 'vtex deploy --force' },
          { emoji: '💾', label: 'Actualizando workspace productivo', command: 'vtex update' }
        ];

        await this.runPipeline(steps);

        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.cyan('\n🌐 Verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        if (!this.dryRun) {
          const { continuar } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continuar',
            message: '¿Los cambios están correctos y deseas continuar?',
            default: false,
          }]);

          if (!continuar) {
            console.log(chalk.yellow('\nProceso cancelado por el usuario'));
            this.log('Proceso cancelado por el usuario tras verificación en production');
            return;
          }
        }

        const finalSteps: DeployStep[] = [
          { emoji: '🔄', label: 'Cambiando a workspace master', command: 'vtex use master' },
          { emoji: '💾', label: 'Actualizando workspace master', command: 'vtex update' }
        ];
        await this.runPipeline(finalSteps);

        console.log(chalk.green('\n✅ Nueva custom app desplegada exitosamente 🚀'));
        this.log('Nueva custom app desplegada exitosamente');
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante el deploy de nueva custom app'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en new custom app:'), error);
      throw error;
    }
  }

  private async executeUpdateCustomApp(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));
      this.log(`Iniciando UPDATE_CUSTOM_APP para vendor: ${this.vendor}`);

      console.log(chalk.blue('\n🔍 Verificando custom app...'));
      if (!(await this.checkCustomAppDirectory() && await this.checkVersionUpdate())) {
        throw new Error('Verificación fallida: directorio o versión incorrectos');
      }

      try {
        const steps: DeployStep[] = [
          { emoji: '👤', label: 'Iniciando sesión en VTEX', command: `vtex login ${this.vendor}` },
          { emoji: '🧹', label: 'Eliminando/limpiando workspace de producción si existe', command: 'vtex workspace delete production' },
          { emoji: '🔄', label: 'Cambiando a workspace production', command: 'vtex use production --production' },
          { emoji: '📦', label: 'Publicando actualización', command: 'vtex publish' },
          { emoji: '🔨', label: 'Ejecutando deploy force', command: 'vtex deploy --force' },
          { emoji: '💾', label: 'Actualizando workspace productivo', command: 'vtex update' }
        ];

        await this.runPipeline(steps);

        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.cyan('\n🌐 Verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        if (!this.dryRun) {
          const { continuar } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continuar',
            message: '¿Los cambios están correctos y deseas continuar?',
            default: false,
          }]);

          if (!continuar) {
            console.log(chalk.yellow('\nProceso cancelado por el usuario'));
            this.log('Proceso cancelado por el usuario tras verificación en production');
            return;
          }
        }

        const finalSteps: DeployStep[] = [
          { emoji: '🔄', label: 'Cambiando a workspace master', command: 'vtex use master' },
          { emoji: '💾', label: 'Actualizando workspace master', command: 'vtex update' }
        ];
        await this.runPipeline(finalSteps);

        console.log(chalk.green('\n✅ Custom app actualizada exitosamente 🚀'));
        this.log('Custom app actualizada exitosamente');
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante la actualización de la custom app'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en update custom app:'), error);
      throw error;
    }
  }

  private async executeMajorStable(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      const themes = await this.getThemeVersions();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));
      this.log(`Iniciando MAJOR_STABLE para vendor: ${this.vendor}, themes: ${themes.from} -> ${themes.to}`);

      try {
        const steps: DeployStep[] = [
          { emoji: '👤', label: 'Iniciando sesión en VTEX', command: `vtex login ${this.vendor}` },
          { emoji: '🧹', label: 'Eliminando/limpiando workspace de producción si existe', command: 'vtex workspace delete production' },
          { emoji: '🔄', label: 'Cambiando a workspace production', command: 'vtex use production --production' },
          { emoji: '🚀', label: 'Ejecutando release major stable', command: 'vtex release major stable' },
          { emoji: '🔌', label: 'Instalando GraphQL IDE', command: 'vtex install vtex.admin-graphql-ide@3.x' }
        ];

        await this.runPipeline(steps);

        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.blue('\n🔄 Proceso de migración requerido'));
        console.log(chalk.yellow(`
          1. Accede a: vtex browse admin/graphql-ide
          2. Selecciona vtex.pages-graphql@2.x
          3. Ejecuta la mutation:
            mutation {
              updateThemeIds(from:"${themes.from}", to:"${themes.to}")
            }
          4. Verifica que la respuesta sea {"data": {"updateThemeIds": true}}`));

        console.log(chalk.cyan('\n🌐 Verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        if (!this.dryRun) {
          const { continuar } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continuar',
            message: '¿La migración se completó correctamente y deseas continuar?',
            default: false,
          }]);

          if (!continuar) {
            console.log(chalk.yellow('\nProceso cancelado por el usuario'));
            this.log('Proceso cancelado por el usuario tras solicitud de migración en major');
            return;
          }
        }

        const finalSteps: DeployStep[] = [
          { emoji: '🚀', label: 'Promoviendo cambios', command: 'vtex promote' }
        ];
        await this.runPipeline(finalSteps);

        console.log(chalk.green('\n✅ Major stable completado exitosamente 🚀'));
        this.log('Major stable completado exitosamente');
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante el major stable'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en major stable:'), error);
      throw error;
    }
  }

  async deploy(): Promise<void> {
    try {
      // Ejecutar el tipo de deploy correspondiente
      switch (this.deployType) {
        case 'PATCH_STABLE':
          await this.executePatchStable();
          break;
        case 'NEW_CUSTOM_APP':
          await this.executeNewCustomApp();
          break;
        case 'UPDATE_CUSTOM_APP':
          await this.executeUpdateCustomApp();
          break;
        case 'MAJOR_STABLE':
          await this.executeMajorStable();
          break;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error durante el proceso:'), error);
      throw error;
    }
  }
}

export const createDeploy = (options?: DeployOptions) => {
  return new VtexDeploy(options);
};
