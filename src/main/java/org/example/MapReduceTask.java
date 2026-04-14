package org.example;

import java.util.List;

public class MapReduceTask {
    private final String jobId;
    private final List<String> chunks;
    private final int nbReducers;

    public MapReduceTask(String jobId, List<String> chunks, int nbReducers) {
        this.jobId = jobId;
        this.chunks = chunks;
        this.nbReducers = nbReducers;
    }

    public String getJobId() { return jobId; }
    public List<String> getChunks() { return chunks; }
    public int getNbReducers() { return nbReducers; }
}