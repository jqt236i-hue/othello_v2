declare const CardCatalog: {
    version: number;
    notes: string;
    cards: ({
        id: string;
        name_ja: string;
        type: string;
        cost: number;
        desc_ja: string;
        display_type_ja: string;
        name: string;
        desc: string;
        enabled?: undefined;
    } | {
        id: string;
        name_ja: string;
        type: string;
        cost: number;
        desc_ja: string;
        enabled: boolean;
        display_type_ja: string;
        name: string;
        desc: string;
    })[];
};
export = CardCatalog;
//# sourceMappingURL=catalog.d.ts.map