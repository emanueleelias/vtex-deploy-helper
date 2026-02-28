import { VtexDeploy } from '../index';
import * as fs from 'fs';
import path from 'path';
import * as inquirer from 'inquirer';

// Mock dependencias externas
jest.mock('fs');
jest.mock('child_process', () => ({
    exec: jest.fn(),
    spawn: jest.fn()
}));
jest.mock('inquirer', () => ({
    prompt: jest.fn()
}));

describe('VtexDeploy', () => {
    let deployer: VtexDeploy;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        // Resetear mocks antes de cada test
        jest.clearAllMocks();

        // Silenciar console.log durante tests
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });

        // Simular un current working directory
        jest.spyOn(process, 'cwd').mockReturnValue('/mock/dir');
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('readManifest', () => {
        it('debería leer exitosamente el vendor de un manifest válido', async () => {
            // Configuramos el mock de fs para que devuelva un json válido
            const mockManifest = JSON.stringify({
                vendor: 'testvendor',
                name: 'testapp',
                version: '1.2.3'
            });
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(mockManifest);

            deployer = new VtexDeploy({ deployType: 'PATCH_STABLE' });

            // Accedemos de esta forma porque los métodos son privados
            const readManifest = (deployer as any).readManifest.bind(deployer);
            const manifest = await readManifest();

            expect(manifest.vendor).toBe('testvendor');
            expect(manifest.version).toBe('1.2.3');
        });

        it('debería lanzar error si no existe el manifest.json', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            deployer = new VtexDeploy({ deployType: 'PATCH_STABLE' });
            const readManifest = (deployer as any).readManifest.bind(deployer);

            await expect(readManifest()).rejects.toThrow('No se encontró el archivo manifest.json');
        });

        it('debería lanzar error si el manifest no tiene vendor', async () => {
            const mockManifest = JSON.stringify({
                name: 'testapp',
                version: '1.2.3'
            });
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(mockManifest);

            deployer = new VtexDeploy({ deployType: 'PATCH_STABLE' });
            const readManifest = (deployer as any).readManifest.bind(deployer);

            await expect(readManifest()).rejects.toThrow('No se encontró el campo "vendor"');
        });
    });

    describe('getThemeVersions', () => {
        it('debería calcular el next major correctamente', async () => {
            const mockManifest = JSON.stringify({
                vendor: 'testvendor',
                name: 'store',
                version: '3.5.1'
            });
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(mockManifest);

            deployer = new VtexDeploy({ deployType: 'MAJOR_STABLE' });
            const getThemeVersions = (deployer as any).getThemeVersions.bind(deployer);

            const themes = await getThemeVersions();

            expect(themes.from).toBe('testvendor.store@3.x');
            expect(themes.to).toBe('testvendor.store@4.x');
        });

        it('debería lanzar error con versión inválida', async () => {
            const mockManifest = JSON.stringify({
                vendor: 'testvendor',
                version: 'invalid_version'
            });
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(mockManifest);

            deployer = new VtexDeploy({ deployType: 'MAJOR_STABLE' });
            const getThemeVersions = (deployer as any).getThemeVersions.bind(deployer);

            await expect(getThemeVersions()).rejects.toThrow('Formato de versión inválido');
        });
    });

    describe('dry-run middleware', () => {
        it('no debería ejecutar comandos si dryRun es true', async () => {
            // Ignorar verificaciones de custom app y confirmaciones de readManifest
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
                vendor: 'testvendor',
                version: '1.0.0'
            }));
            (inquirer.prompt as unknown as jest.Mock).mockResolvedValue({ isInDirectory: true, continuar: true });

            // Instanciamos con dryRun = true
            deployer = new VtexDeploy({ deployType: 'PATCH_STABLE', dryRun: true });

            const runPipeline = (deployer as any).runPipeline.bind(deployer);
            const steps = [
                { emoji: '🤷', label: 'Test Step', command: 'echo "test"' }
            ];

            await runPipeline(steps);

            // Verificamos por medio del log en consola simulado que se saltó
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[dry-run] Comando omitido'));

            // Aquí mock_spawn/exec no se invocan porque el test pasa sobre `child_process`
            // directamente.
        });
    });
});
