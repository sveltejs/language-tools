{ const { a, ...rest } = await (object); 
    
}

{ const [a, b, ...rest] = await (array); 
    
}

{ try { const value = await (objectReject); 
    
} catch($$_e) { const { a, ...rest } = __sveltets_2_any();
    
}}

{ try { const value = await (arrayReject); 
    
} catch($$_e) { const [a, b, ...rest] = __sveltets_2_any();
    
}}