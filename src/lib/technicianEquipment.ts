export interface EquipmentItem {
  id: string;
  label: string;
  required: boolean;
  category?: string;
}
export const CATEGORY_EQUIPMENT_CHECKLIST: Record<string, EquipmentItem[]> = {
  AC_REPAIR: [
    { id: 'AC_VACUUM_PUMP', label: 'Deep Vacuum Pump (for gas evacuation & leak testing)', required: true },
    { id: 'AC_MANIFOLD_GAUGE', label: 'Digital/Analog Manifold Pressure Gauge Set', required: true },
    { id: 'AC_CLAMP_METER', label: 'True-RMS Clamp Multimeter (Current/Voltage)', required: true },
    { id: 'AC_LEAK_DETECTOR', label: 'Electronic Refrigerant Leak Detector / Soap Spray', required: true },
    { id: 'AC_FIN_COMB', label: 'Fin Comb & Condenser Coil Cleaner Kit', required: false },
    { id: 'SAFETY_BOOTS', label: 'Safety Shoes / Anti-skid Footwear', required: true },
  ],
  ELECTRICAL: [
    { id: 'ELEC_MULTIMETER', label: 'True-RMS Digital Multimeter (CAT III/IV rated)', required: true },
    { id: 'ELEC_INSULATED_TOOLS', label: '1000V Certified Insulated Pliers & Screwdriver Set', required: true },
    { id: 'ELEC_NEON_TESTER', label: 'Non-contact AC Voltage Tester / Neon Pen', required: true },
    { id: 'ELEC_WIRE_STRIPPER', label: 'Precision Wire Stripper & Crimping Pliers', required: true },
    { id: 'ELEC_SAFETY_GLOVES', label: 'Dielectric Rubber Insulated Safety Gloves', required: true },
  ],
  PLUMBING: [
    { id: 'PLUMB_PIPE_WRENCH', label: 'Heavy-Duty Pipe Wrench (10" & 14")', required: true },
    { id: 'PLUMB_BASIN_WRENCH', label: 'Telescopic Basin Wrench for Faucets & Sinks', required: true },
    { id: 'PLUMB_PIPE_CUTTER', label: 'CPVC/PPR Tube & Pipe Cutter', required: true },
    { id: 'PLUMB_DRAIN_AUGER', label: 'Hand/Machine Drain Snake Auger (for blockages)', required: true },
    { id: 'PLUMB_SEAL_KIT', label: 'Teflon/PTFE Thread Sealant & Washer Assortment', required: true },
  ],
  CARPENTRY: [
    { id: 'CARP_CORDLESS_DRILL', label: 'Cordless Drill/Driver with Wood & Metal Bits', required: true },
    { id: 'CARP_SPEED_SQUARE', label: 'Precision Combination / Speed Square & Measuring Tape', required: true },
    { id: 'CARP_CHISEL_SET', label: 'Beveled Wood Chisel Set (1/4" to 1")', required: true },
    { id: 'CARP_HAND_SAW', label: 'Tenon / Flush Cut Pull Saw', required: true },
    { id: 'SAFETY_GOGGLES', label: 'Protective Safety Goggles & Dust Mask', required: true },
  ],
  PAINTING: [
    { id: 'PAINT_PUTTY_KNIFE', label: 'Stainless Steel Putty / Scraper Knives (Various sizes)', required: true },
    { id: 'PAINT_DROP_SHEETS', label: 'Heavy Plastic & Canvas Floor Protection Drop Sheets', required: true },
    { id: 'PAINT_SANDING_KIT', label: 'Sanding Block / Electric Orbital Sander with Dust Bag', required: true },
    { id: 'PAINT_ROLLER_SET', label: 'Professional Microfiber Rollers & Angular Sash Brushes', required: true },
    { id: 'PAINT_RESPIRATOR', label: 'Dual Cartridge Paint Vapor Respirator Mask', required: true },
  ],
  HOME_CLEANING: [
    { id: 'CLEAN_VACUUM', label: 'Industrial Wet & Dry Commercial Vacuum Cleaner', required: true },
    { id: 'CLEAN_STEAM_EXTRACTOR', label: 'High-Pressure Steam Cleaning Machine', required: true },
    { id: 'CLEAN_MICROFIBER_KIT', label: 'Color-Coded Microfiber Cloths & Mop Pads', required: true },
    { id: 'CLEAN_SAFETY_GEAR', label: 'Nitrile Gloves, Goggles, and Non-Slip Booties', required: true },
  ],
  PEST_CONTROL: [
    { id: 'PEST_SPRAYER', label: 'Knapsack Compression Sprayer (Brass Nozzle)', required: true },
    { id: 'PEST_ULV_FOGGER', label: 'ULV Cold Fogging Machine for Misting', required: true },
    { id: 'PEST_GEL_APPLICATOR', label: 'Precision Cockroach Bait Gel Gun', required: true },
    { id: 'PEST_RESPIRATOR_MASK', label: 'Organic Vapor Filter Chemical Mask & Goggles', required: true },
  ],
  APPLIANCE_REPAIR: [
    { id: 'APP_MULTIMETER', label: 'Digital Multimeter with Capacitance & Microamp Metering', required: true },
    { id: 'APP_SOCKET_SET', label: 'Metric & Imperial Socket / Hex Ratchet Kit', required: true },
    { id: 'APP_NUT_DRIVERS', label: 'Magnetic Nut Driver Set & Torx Bits', required: true },
    { id: 'APP_SAFETY_GLOVES', label: 'Cut-Resistant Mechanix Work Gloves', required: true },
  ],
  BATHROOM_LEAKAGES: [
    { id: 'LEAK_MOISTURE_METER', label: 'Pinless / Pin Moisture Detection Meter', required: true },
    { id: 'LEAK_PRESSURE_TEST_PUMP', label: 'Hydrostatic Pipeline Pressure Testing Pump', required: true },
    { id: 'LEAK_INSPECTION_CAMERA', label: 'Flexible Endoscope / Borescope Camera', required: true },
    { id: 'LEAK_CAULK_GUN', label: 'Professional Silicone Sealant & Grout Applicator Gun', required: true },
  ],
  FALSE_CEILING: [
    { id: 'CEIL_LASER_LEVEL', label: 'Self-Leveling 360-degree Green Beam Laser Level', required: true },
    { id: 'CEIL_DRYWALL_GUN', label: 'High-Speed Drywall Screw Gun with Depth Locator', required: true },
    { id: 'CEIL_TIN_SNIPS', label: 'Aviation Tin Snips (Left, Right, Straight Cut)', required: true },
    { id: 'CEIL_STUD_FINDER', label: 'Electronic Metal Channel / Stud Finder', required: true },
  ],
  KITCHEN_RENOVATION: [
    { id: 'KITCH_ANGLE_GRINDER', label: 'Heavy Angle Grinder with Granite/Tile Diamond Blade', required: true },
    { id: 'KITCH_JIGSAW', label: 'Orbital Action Jigsaw with Countertop Laminate Blades', required: true },
    { id: 'KITCH_HOLE_SAW', label: 'Diamond Core Hole Saw Kit (for sink & pipe holes)', required: true },
    { id: 'KITCH_PRECISION_LEVEL', label: 'Magnetic 24" & 48" Spirit Box Level', required: true },
  ],
};

export function getEquipmentForCategories(categories: string[] = []): EquipmentItem[] {
  const seenIds = new Set<string>();
  const items: EquipmentItem[] = [];

  for (const cat of categories) {
    const list = CATEGORY_EQUIPMENT_CHECKLIST[cat] || [];
    for (const item of list) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push({ ...item, category: cat });
      }
    }
  }

  if (!seenIds.has('SAFETY_FOOTWEAR_ALL')) {
    items.push({
      id: 'SAFETY_FOOTWEAR_ALL',
      label: 'Standard Protective Shoes & Clean Uniform/KraftNex T-shirt',
      required: true,
      category: 'GENERAL',
    });
  }

  return items;
}

export function getEquipmentLabel(idOrLabel: string): string {
  if (!idOrLabel) return '';
  for (const list of Object.values(CATEGORY_EQUIPMENT_CHECKLIST)) {
    const found = list.find((i) => i.id === idOrLabel);
    if (found) return found.label;
  }
  if (idOrLabel === 'SAFETY_FOOTWEAR_ALL') {
    return 'Standard Protective Shoes & Clean Uniform/KraftNex T-shirt';
  }
  if (idOrLabel.includes(' ') && !idOrLabel.includes('_')) {
    return idOrLabel;
  }
  return idOrLabel
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
