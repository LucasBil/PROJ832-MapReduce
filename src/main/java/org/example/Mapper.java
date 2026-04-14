package org.example;

import java.util.HashMap;
import java.util.Map;

public class Mapper {
    public Map<String, Integer> map(String input) {
        Map<String, Integer> result = new HashMap<>();
        String[] words = input.toLowerCase().split("\\s+");

        for (String word : words) {
            result.merge(word, 1, Integer::sum);
        }
        return result;
    }
}
