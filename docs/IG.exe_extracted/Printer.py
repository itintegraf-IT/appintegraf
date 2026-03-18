import win32print
from win32printing import Printer
#import webbrowser

def EPSON_FX(Cesta):
    Tiskarna1=win32print. GetDefaultPrinter()
    Tiskarna2= "EPSON FX-890 ESC/P"
    #print ("Default printer: ",Tiskarna1)
    #print ("Printer Inkjet: ",Tiskarna2)
    """win32print.SetDefaultPrinter(Tiskarna2) # přenastavení defaultní tiskárny"""
    #handle = win32print.OpenPrinter(printer_name)
    #properties = win32print.GetPrinter(handle, 2)
    #devmode = properties['pDevMode']
    #devmode.PaperSize=win32con.DMPAPER_11X17
    # Nactení souboru:
    #Cesta="C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\Sestavy_IGT\\INKJETY\\06_00093.txt"

    #Strana1=11*"\n" # IMG_1
    #Strana2=""# IMG_1
    Strana1 = 11* "\n"  # horní okraj 1. strany
    Strana2 = 8*"\n" # horní okraj 2. strany
    r = 1
    with open(Cesta, "r", encoding="utf8") as f:  # načtení ks z hotových TXT
        #webbrowser.open(Cesta)
        for radek in f.readlines():# celkem 138 řádků
            #print ("23", radek)
            #if 1 <= r <= 82 : # IMG_1
            if 1 <= r <= 70:  # IMG_2
                #Strana1=Strana1+str(r)+" "+radek # CISLOVANI RADKU !!!
                Strana1 = Strana1 +  radek # BEZ cislovani radku
                #print (str(r)+" "+radek.replace("\n",""))
            #elif 84 <= r<=158 : # IMG_1
            #elif 86 <= r <= 168:  # IMG_2
            elif 85 <= r <= 158:  # IMG_3
                #Strana2=Strana2+str(r)+" "+radek # CISLOVANI RADKU!!!
                Strana2 = Strana2  + radek #BEZ cislovani radku
                #print (str(r)+" "+radek.replace("\n",""))
            else: pass
            r=r+1

    # PRINTING po 2 stránkách
    #font= { "height": 10, "faceName":'Sans Serif',"italic":False,} #  (right, top, ...........)
    font = {"height": 10, "faceName": 'Roman', "italic": False, }  # (right, top, ...........)
    with Printer(linegap=0,  auto_page=False) as printer:  #linegap: rozpal mezi řádky,  (right, top, ...........),  auto_page =stránkování
        printer.text(Strana1, font_config=font, align='left')

    with Printer(linegap=0,  auto_page=False) as printer:  #linegap: rozpal mezi řádky,  (right, top, ...........),  auto_page =stránkování
        printer.text(Strana2, font_config=font, align='left')

    """win32print.SetDefaultPrinter(Tiskarna1) # vrácení nastavení defaultní tiskárny"""
    print("Default printer: ", Tiskarna1)


"""Tisk 24 inch, utrhnout a pak Load/Eject aby  papír najel na start.  Zrušit tisk úlohu = Reset nebo ještě v tisk. frontě"""
"""Předvolby tisku: Papír a kvalita: Automaticky vybrat, Rozložení-Upřesnit-Formát paíru: Německý legal skládaný, Kvalita tisku 120 x 72 dots p.i."""
