package org.example;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.command.CreateContainerResponse;
import com.github.dockerjava.api.command.WaitContainerResultCallback;
import com.github.dockerjava.api.model.*;
import com.github.dockerjava.core.*;
import com.github.dockerjava.httpclient5.ApacheDockerHttpClient;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class MasterNode {
    public static int numMappers = 3;
    public static int numReducers = 1;
    public static String inputPath = "input.txt";

    private final DockerClient docker;
    private final List<String> containerIds = new ArrayList<>();

    // Chemin du volume sur la machine HÔTE (monté dans les conteneurs)
    private static final String HOST_SHARED_DIR = System.getProperty("java.io.tmpdir") + "\\mapreduce-shared";
    // Chemin VU depuis l'intérieur des conteneurs
    private static final String CONTAINER_SHARED_DIR = "/shared";

    public MasterNode() {
        String os = System.getProperty("os.name").toLowerCase();
        String dockerHost = os.contains("win")
                ? "npipe:////./pipe/docker_engine"
                : "unix:///var/run/docker.sock";

        DefaultDockerClientConfig config = DefaultDockerClientConfig
                .createDefaultConfigBuilder()
                .withDockerHost(dockerHost)
                .build();

        ApacheDockerHttpClient httpClient = new ApacheDockerHttpClient.Builder()
                .dockerHost(config.getDockerHost())
                .build();

        this.docker = DockerClientImpl.getInstance(config, httpClient);
    }

    public Map<String, Integer> execute(MapReduceTask task) throws Exception {
        System.out.println("=== JOB : " + task.getJobId() + " ===");

        // 1. Préparer le volume partagé sur l'hôte
        prepareSharedVolume(task);

        // 2. Phase MAP : lancer les conteneurs Mapper en parallèle
        runMappers(task);

        // 3. Phase REDUCE : lancer les conteneurs Reducer en parallèle
        runReducers(task);

        // 4. Lire les résultats depuis le volume partagé
        Map<String, Integer> result = collectResults(task.getNbReducers());

        // 5. Nettoyage
        cleanup();

        return result;
    }

    // -------------------------------------------------------------------------
    // Préparation du volume
    // -------------------------------------------------------------------------

    private void prepareSharedVolume(MapReduceTask task) throws IOException {
        Path sharedPath = Paths.get(HOST_SHARED_DIR);
        // Nettoyer le dossier s'il existe déjà
        if (Files.exists(sharedPath)) {
            deleteRecursively(sharedPath);
        }
        Files.createDirectories(sharedPath);

        // Créer les sous-dossiers pour chaque reducer
        for (int i = 0; i < task.getNbReducers(); i++) {
            Files.createDirectories(sharedPath.resolve("reducer-" + i));
        }

        // Copier les scripts dans le volume pour les rendre accessibles aux conteneurs
        copyScript("mapper.sh", sharedPath.resolve("mapper.sh"));
        copyScript("reducer.sh", sharedPath.resolve("reducer.sh"));

        System.out.println("Volume partagé prêt : " + HOST_SHARED_DIR);
    }

    private void copyScript(String resourceName, Path destination) throws IOException {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(resourceName)) {
            if (in == null) throw new FileNotFoundException("Script introuvable : " + resourceName);
            Files.copy(in, destination, StandardCopyOption.REPLACE_EXISTING);
        }
        destination.toFile().setExecutable(true);
    }

    // -------------------------------------------------------------------------
    // Phase MAP
    // -------------------------------------------------------------------------

    private void runMappers(MapReduceTask task) throws Exception {
        System.out.println("\n--- Phase MAP ---");
        List<String> chunks = task.getChunks();
        int nbReducers = task.getNbReducers();
        List<Thread> threads = new ArrayList<>();

        for (int i = 0; i < chunks.size(); i++) {
            final int mapperIndex = i;
            final String chunk = chunks.get(i);

            Thread t = new Thread(() -> {
                try {
                    String containerId = spawnMapper(mapperIndex, nbReducers, chunk);
                    waitForContainer(containerId);
                    System.out.println("[Mapper-" + mapperIndex + "] conteneur terminé.");
                } catch (Exception e) {
                    System.err.println("[Mapper-" + mapperIndex + "] ERREUR : " + e.getMessage());
                }
            });
            threads.add(t);
            t.start();
        }

        for (Thread t : threads) t.join(); // attendre tous les mappers
        System.out.println("--- Tous les Mappers ont terminé ---");
    }

    private String spawnMapper(int index, int nbReducers, String chunk) {
        // La commande exécute le script mapper.sh avec les données en argument
        String cmd = String.format(
                "sh /shared/mapper.sh %d %d %s",
                index, nbReducers, chunk.replace("'", "\\'")
        );

        Bind volumeBind = new Bind(
                HOST_SHARED_DIR,
                new Volume(CONTAINER_SHARED_DIR)
        );

        CreateContainerResponse container = docker
                .createContainerCmd("alpine:latest")
                .withName("mapper-" + index + "-" + System.currentTimeMillis())
                .withCmd("sh", "-c", cmd)
                .withHostConfig(
                        HostConfig.newHostConfig()
                                .withBinds(volumeBind)          // ← montage du volume
                )
                .withLabels(Map.of("role", "mapper", "job", "word-count"))
                .exec();

        docker.startContainerCmd(container.getId()).exec();
        synchronized (containerIds) {
            containerIds.add(container.getId());
        }
        System.out.println("[Mapper-" + index + "] démarré : " + container.getId().substring(0, 12));
        return container.getId();
    }

    // -------------------------------------------------------------------------
    // Phase REDUCE
    // -------------------------------------------------------------------------

    private void runReducers(MapReduceTask task) throws Exception {
        System.out.println("\n--- Phase REDUCE ---");
        List<Thread> threads = new ArrayList<>();

        for (int i = 0; i < task.getNbReducers(); i++) {
            final int reducerIndex = i;

            Thread t = new Thread(() -> {
                try {
                    String containerId = spawnReducer(reducerIndex);
                    waitForContainer(containerId);
                    System.out.println("[Reducer-" + reducerIndex + "] conteneur terminé.");
                } catch (Exception e) {
                    System.err.println("[Reducer-" + reducerIndex + "] ERREUR : " + e.getMessage());
                }
            });
            threads.add(t);
            t.start();
        }

        for (Thread t : threads) t.join(); // attendre tous les reducers
        System.out.println("--- Tous les Reducers ont terminé ---");
    }

    private String spawnReducer(int index) {
        String cmd = "sh /shared/reducer.sh " + index;

        Bind volumeBind = new Bind(
                HOST_SHARED_DIR,
                new Volume(CONTAINER_SHARED_DIR)
        );

        CreateContainerResponse container = docker
                .createContainerCmd("alpine:latest")
                .withName("reducer-" + index + "-" + System.currentTimeMillis())
                .withCmd("sh", "-c", cmd)
                .withHostConfig(
                        HostConfig.newHostConfig()
                                .withBinds(volumeBind)          // ← même volume partagé
                )
                .withLabels(Map.of("role", "reducer", "job", "word-count"))
                .exec();

        docker.startContainerCmd(container.getId()).exec();
        synchronized (containerIds) {
            containerIds.add(container.getId());
        }
        System.out.println("[Reducer-" + index + "] démarré : " + container.getId().substring(0, 12));
        return container.getId();
    }

    // -------------------------------------------------------------------------
    // Collecte des résultats
    // -------------------------------------------------------------------------

    private Map<String, Integer> collectResults(int nbReducers) throws IOException {
        System.out.println("\n--- Collecte des résultats ---");
        Map<String, Integer> finalResult = new TreeMap<>();

        for (int i = 0; i < nbReducers; i++) {
            Path resultFile = Paths.get(HOST_SHARED_DIR, "result-" + i + ".txt");
            if (!Files.exists(resultFile)) {
                System.out.println("[Reducer-" + i + "] aucun fichier résultat.");
                continue;
            }
            List<String> lines = Files.readAllLines(resultFile);
            for (String line : lines) {
                String[] parts = line.trim().split("\\s+");
                if (parts.length == 2) {
                    finalResult.merge(parts[0], Integer.parseInt(parts[1]), Integer::sum);
                }
            }
        }
        return finalResult;
    }

    // -------------------------------------------------------------------------
    // Utilitaires
    // -------------------------------------------------------------------------

    /** Bloque jusqu'à ce que le conteneur s'arrête */
    private void waitForContainer(String containerId) throws InterruptedException {
        docker.waitContainerCmd(containerId)
                .exec(new WaitContainerResultCallback())
                .awaitCompletion();
    }

    public void cleanup() {
        System.out.println("\n--- Nettoyage des conteneurs ---");
        for (String id : containerIds) {
            try {
                docker.removeContainerCmd(id).withForce(true).exec();
                System.out.println("Supprimé : " + id.substring(0, 12));
            } catch (Exception e) {
                System.err.println("Erreur suppression " + id + " : " + e.getMessage());
            }
        }
        containerIds.clear();
    }

    private void deleteRecursively(Path path) throws IOException {
        if (Files.isDirectory(path)) {
            try (var entries = Files.list(path)) {
                for (Path entry : entries.toList()) deleteRecursively(entry);
            }
        }
        Files.delete(path);
    }

    // -------------------------------------------------------------------------
    // Main
    // -------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        MasterNode master = new MasterNode();

        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--mappers")) MasterNode.numMappers = Integer.parseInt(args[++i]);
            if (args[i].equals("--reducers")) MasterNode.numReducers = Integer.parseInt(args[++i]);
            if (args[i].equals("--input")) MasterNode.inputPath = args[++i];
        }

        String content = Files.readString(Paths.get(MasterNode.inputPath));
        List<String> paragraphs = List.of(content.split("\\R\\s*\\R"))
                .stream()
                .map(String::trim)
                .filter(p -> !p.isEmpty())
                .collect(Collectors.toList());

        List<String> chunks = new ArrayList<>();
        for (int i = 0; i < MasterNode.numMappers; i++) {
            final int mapperIndex = i;
            String chunk = IntStream.range(0, paragraphs.size())
                    .filter(j -> j % MasterNode.numMappers == mapperIndex)
                    .mapToObj(paragraphs::get)
                    .collect(Collectors.joining(" "));
            if (!chunk.isEmpty()) chunks.add(chunk);
        }

        MapReduceTask task = new MapReduceTask(
                "word-count-job-1",
                chunks,
                MasterNode.numReducers
        );

        Map<String, Integer> result = master.execute(task);

        System.out.println("\n=== RÉSULTAT FINAL ===");
        result.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .forEach(e -> System.out.printf("  %-15s : %d%n", e.getKey(), e.getValue()));
    }
}