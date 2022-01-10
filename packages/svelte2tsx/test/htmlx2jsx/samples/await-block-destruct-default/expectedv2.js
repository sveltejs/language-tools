    { const $$_value = await (object); { const { a = 3, b = 4, c } = $$_value; 
    
}}

    { const $$_value = await (array); { const [a, b, c = 3] = $$_value; 
    
}}

      { try { const $$_value = await (objectReject); { const value = $$_value; 
    
}} catch($$_e) { const { a = 3, b = 4, c } = __sveltets_2_any();
    
}}

      { try { const $$_value = await (arrayReject); { const value = $$_value; 
    
}} catch($$_e) { const [a, b, c = 3] = __sveltets_2_any();
    
}}