{ const { a = 3, b = 4, c } = await (object); 
    
}

{ const [a, b, c = 3] = await (array); 
    
}

{ try { const value = await (objectReject); 
    
} catch($$_e) { const { a = 3, b = 4, c } = __sveltets_2_any();
    
}}

{ try { const value = await (arrayReject); 
    
} catch($$_e) { const [a, b, c = 3] = __sveltets_2_any();
    
}}