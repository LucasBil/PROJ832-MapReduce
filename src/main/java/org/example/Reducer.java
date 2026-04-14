package org.example;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Reducer {
    public Map<String, Integer> reduce(List<Map<String, Integer>> mapperResults) {
        Map<String, Integer> finalResult = new HashMap<>();

        for (Map<String, Integer> mapperResult : mapperResults) {
            mapperResult.forEach((key, value) ->
                    finalResult.merge(key, value, Integer::sum)
            );
        }

        return finalResult;
    }
}
