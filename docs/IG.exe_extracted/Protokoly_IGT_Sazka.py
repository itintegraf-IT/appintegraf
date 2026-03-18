# -*- coding: UTF-8 -*-
## -*- coding: UTF-8 -*-
## -*- coding: iso-8859-2 -*- 
## -*- coding: UTF-16 -*-
## -*- coding: iso-8859-2 -*-
## -*- coding: latin1 -*-
##- coding: CP1250 -*-
##*- coding: CP1251 -*
## -*- coding: UTF-32 -*-
## -*- coding: iso-8859-1 -*-
## -*- coding: iso-10646-1 -*-
## -*- coding: cp852
#import unicodedata
#import charade # detekce kódování
#import Image1
#from PIL import Image,PngImagePlugin
import os
#import string
#from barcodeEAN import EanBarCode
#import base64
#import shelve
import webbrowser
#from shutil import copyfile
import ctypes # chybové hlášky 
from fpdf import FPDF
import Printer
#import win32api # tisk
#import win32con
#import win32print # tisk
#import wx
#from wx.html import HtmlEasyPrinting
#import pdfkit
#import weasyprint # PDF z HTML
#import pdfkit  # PDF z HTML

CWD=os.getcwd() # getcvd vrátí adresu  "current working directory"
#global TableL1

"""
def PrehozLog(CestaUloz): # vznik protokolu , TN= Tisk/Náhled
        try: copyfile(CWD+"\\Loga\\" +'LogoCD.png', CestaUloz+"\\HTML\\"+'LogoCD.png')# přehození loga do adresáře TXT
        except: print ("   Logo nenalezeno")
        try: copyfile(CWD+"\\Loga\\" +'LogoDPB.png', CestaUloz+"\\HTML\\"+'LogoDPB.png')# přehození loga do adresáře TXT
        except: print ("   Logo nenalezeno")        
"""
def NacteniTXT(CestaTxt, BALIL1): # Načtení z každého TXT   (OK_Print:  A= spuštěno z "OK" N= spuštěno z "PRINT")
    #ST = FPDF(orientation='P', unit='mm', format=("A4"))#  štítek na jednu stránku
    #ST.add_page()  # štítek na jednu stránku
    #ST.add_font('DejaVu-Bold', '', 'Fonty\\DejaVuSansCondensed-Bold.ttf', uni=True) # font Latin1
    #ST.add_font('DejaVu', '', 'Fonty\\DejaVuSansCondensed.ttf', uni=True) # font Latin1 # po run vznikne .pkl, které  obsahuje nastavení vč. cesta
    #print ("51", CestaTxt)
    with open(CestaTxt, "r", encoding="utf8") as f:  # načtení ks z hotových TXT
            VypisL=f.readlines() #načtení  obsahu TXT po řádcích do listu
            #print ("54 ",VypisL)
            if len (VypisL)>1: #eliminace prázdných (nehotových)
                #print ("........",(VypisL))
                #MNOZSTVI=str(len(VypisL)-6) # 6= počet řádků za tabulkou
                #CisloKrabice="..................";JOB="....
                for sekvence in VypisL:              
                    if sekvence.count( "JOB" ) ==1: JOB=sekvence.replace("JOB: ", '').replace("\n", '').replace(" ","")
                    else: pass    
                    if sekvence.count( "BALIL" ) ==1: BALIL=sekvence.replace("BALIL: ", '').replace("\n", '')
                    else: pass #BALIL=BALIL.replace("\n", '') #  načteno z paramerů  funkce - tisk rozdělané krabice
                    if sekvence.count( "SERIE" ) ==1:  SERIE=sekvence.replace("SERIE:", '').replace("\n", '').replace(" ","")
                    else: pass
                    if sekvence.count( "CISLO_KRABICE" ) ==1: CisloKrabice=sekvence.replace("CISLO_KRABICE:", '').replace("\n", '').replace(" ","")
                    else: pass #CisloKrabice="0"
                    #print ("71...",CisloKrabice, sekvence.count( "CISLO_KRABICE" ) )
                    if sekvence.count( "PRODUKCE" ) ==1:  PRODUKCE=sekvence.replace("PRODUKCE: ", '').replace("\n", '').replace(" ","")
                    else: pass #PRODUKCE=""
                    if sekvence.count( "CISLO_PALETY:" ) ==1:
                        CISLO_PALETY =sekvence.replace("CISLO_PALETY: ", '').replace("\n", '').replace(" ","")
                        if CISLO_PALETY=="-": CISLO_PALETY="  "
                        #print ("....76","CisloKrabice krabice: ", CisloKrabice, "Krabice na pal.: ", CISLO_PALETY)
                    else: pass #CISLO_PALETY=""
            else: CisloKrabice="Prazdna krabice"; BALIL="";PRODUKCE="";CISLO_PALETY="" # prázdný protokol                   
            VypisL=[n for n in VypisL if n.count ("|")== 3] #  filtr pouze pro tabulku  !!!
            #print  ("80  ", "JOB", JOB, "BALIL", BALIL)
    return  {"JOB":JOB, "BALIL":BALIL, "SERIE":SERIE, "CisloKrabice":CisloKrabice, "PRODUKCE":PRODUKCE,"CISLO_PALETY": CISLO_PALETY , "VypisL":VypisL}
def Stitek_Krabice(CestaTxtL, Cesta,NT): # automaticky po každém výhozu se načte ze 6 krabic
    #print ("... 81", CestaTxtL)
    IP=""; Row=""
    print(); print ("JET PRINTING")
    i=0
    for CestaTxt in CestaTxtL:
        NacteniTxtD = NacteniTXT(CestaTxt, "")
        #print ("92", NacteniTxtD)
        VypisL = (NacteniTxtD["VypisL"]);
        CisloKrabice = (NacteniTxtD["CisloKrabice"]); CisloKrabice = ("{:0>6d}".format(int(CisloKrabice)))
        SERIE = (NacteniTxtD["SERIE"]);
        CISLO_PALETY = (NacteniTxtD["CISLO_PALETY"]); CisloPalety = ("{:0>2d}".format(int(CISLO_PALETY)))# načteno z TXT
        #BALIL = (NacteniTxtD["BALIL"]);
        # print (VypisL)
        MNOZSTVI = str(len(VypisL))  # 8= počet řádků za tabulkou !!!!!
        #VypisL.reverse()  # převrácení Listu !  Jednička na začátek
        #print (VypisL)
        print ("Krabice: ",CisloKrabice)
        #print("Prefix: ",SERIE)
        #print ("Roli v krabici: ",MNOZSTVI)
        #print ()
        Zacatek=0; Konec=999999999 ; CelkvRolich=0 # pro nalezení začátku a konce. čísla
        x1=30; x2=93
        for pol in VypisL: #
            polL=(pol.replace("\n","").replace("_","").replace(" ","")).split("|")
            if int(polL[2]) < int (Konec): Konec=polL[2] #
            if int(polL[3]) > int (Zacatek): Zacatek = polL[3]#
            CiselvRoli= (int(polL[3]) - int(polL[2]))
            CelkvRolich= CelkvRolich+CiselvRoli
            Row1=polL[2]+"-"+polL[3]+ x2*(" ")+ str(CiselvRoli)
            #print (Row1)
            Row=Row+Row1+"\n"
        #print("Zacatek: ", Zacatek)
        #print("Konec: ", Konec)
        #print("Celkem: ", CelkvRolich)
        i=i+1
        IP = IP + x1 * ' ' + str(CisloKrabice) + 75 * ' ' + "5,40 kg" + '\n' + x1 * ' ' + str(Zacatek) + '\n' + x1 * ' ' + str(Konec) + 2 * '\n' + x1 * ' ' + SERIE + 2 * '\n'
        IP = IP + Row +'\n'+ 36 *' ' + str(MNOZSTVI) + 86 *' ' + str(CelkvRolich) +'\n'
        IP = IP + 17 * ('\n')# gap mezi krabicema
        #print(IP)
        Row = "" #
    NazevSestavy=str(CisloPalety)+"_"+str(CisloKrabice)
    CestaSestava=Cesta + "Sestavy_IGT\\INKJETY\\" + NazevSestavy+'.txt' # pro uložení i tisk
    with open(CestaSestava, "w", encoding="utf-8") as g:
        #print ("126", CestaSestava)
        g.write(IP)  # poslední záznam
        #print (NT)
        if (NT) == (1,) or (NT) ==(0,1):  # (0,0)=tisk zapnuty !, (0,1)=Tisk i náhled,, (1,)= jen Náhled
                webbrowser.open(CestaSestava)  # zobrazení TXT
        else: pass
    #print (NT)
    if (NT)==(0,0) or  (NT)==(0,1): # (0,0)=tisk zapnuty !
            #print ("NT ", NT)
            Printer.EPSON_FX(CestaSestava)# ZAPNOUT!!!
            print(); print("    Posláno do tisk. EPSON FX-890 ESC/P...."); print()
    else: print ("  Tisk off")
    #except: print ("!  Zkontroluj tiskárnu  !")
        #webbrowser.open(Cesta + "Sestavy_IGT\\INKJETY\\" + NazevSestavy+'.txt')
def Stitek_Paleta(Cesta, CisloPalety,CisloZakazky,TxtL): # TxtL jen když je poslaný z Okna
    CestaTxt=Cesta+ "\TXT"
    CestaPaletaPDFL = [];
    #print ("143  ", (os.listdir(CestaTxt)))
     # když není vybrán seznam (Button Print) pak načítá automaticky po 100 ks

    TxtL2 = sorted(TxtL, key=lambda x: int(x.split('_')[0])) # řazení listu podle prvního splitu
    #print ("....145  ",TxtL2)

    #print("152  ", (TxtL2))
    CisloZakazky=(TxtL2[0].split("_"))[1] #z prvního Txt  se načte paleta a zakázka
    CisloPalety=(TxtL2[0].split("_"))[2]; CisloPaletyF=("{:0>2d}".format(int(CisloPalety)))
    #
    print("Cislo zakazky: ", CisloZakazky)
    print("Cislo palety: ", CisloPalety)

    NazevSestavy = str(TxtL[0])
    cestaPDF_PL = Cesta + "Sestavy_IGT\\PALETY\\"+ "PAL_"+NazevSestavy+".pdf"
    CestaPaletaPDFL.append(cestaPDF_PL)

    PL = FPDF(orientation='P', unit='mm', format='A4')  #
    PL.add_page();
    PL.add_font('DejaVu-Bold', '', 'Fonty\\DejaVuSansCondensed-Bold.ttf', uni=True)  # font Latin1
    PL.add_font('DejaVu', '', 'Fonty\\DejaVuSansCondensed.ttf', uni=True)  # font Latin1 # po run vznikne .pkl, které  obsahuje nastavení vč. cesta

    PL.set_font('DejaVu-Bold', '', 12)
    Nadpis1 = ("Paletový lístek");
    PL.cell(0, 6, Nadpis1, border=0, ln=2, align="C")  # šířka, výška  border=0/1; align the text L/C/R;  0/1/2: to the right/to the beginning of the next line/below

    PL.set_font('DejaVu-Bold', '', 9)
    Nadpis2 = ("Číslo zakázky: "+ str(CisloZakazky)+ ",  Paleta č: " + CisloPaletyF  );
    PL.cell(0,3, Nadpis2, border=0, ln=2, align="C")

    #PL.set_font('DejaVu', '', 7) # číslování stránek
    #PL.cell(0, 3, "str : "+str(PL.page_no()), border=1, ln=2, align="C")# číslo stránky, okraj,....umístění R,C,L
    PL.set_font('DejaVu', '', 7)  # tabulka
    th = 1.45 * PL.font_size;
    #PL.set_font('DejaVu-Bold', '', 3);

    x1 =18;  x2= 110; # pravý a levý nadpis
    for x in (x1,x2):
        PL.set_xy(x, 25)  # tab. vlevo
        PL.cell(10, 1.5 * th, "Č. pal.", border=1, ln=0, align="C")  # ln = nový řádek !
        PL.cell(15, 1.5 * th, "Č. krabice", border=1, ln=0, align="C") # ln = nový řádek !
        PL.cell(22, 1.5 * th, "Od čísla", border=1, ln=0, align="C")  # ln = nový řádek !
        PL.cell(22, 1.5 * th, "Do čísla", border=1, ln=0, align="C") # ln = nový řádek !
        PL.cell(15, 1.5 * th, "Série", border=1, ln=1, align="C") # ln = nový řádek !
    PL.set_font('DejaVu', '', 7); # tabulka

    i= 1;r=0; RadekL1=[]; RadekL2=[];

    for Txt in TxtL2: #TxtL2 list cest k TXT souborům
        #print ("195",Txt)
        CestaTxt = Cesta + "\\TXT\\" + Txt;
        #print ("143",CestaTxt)
        NacteniTxtD = NacteniTXT(CestaTxt,  "")
        VypisL = (NacteniTxtD["VypisL"]);

        #print (NacteniTxtD)
        CisloKrabice = (NacteniTxtD["CisloKrabice"]); CisloKrabiceF=("{:0>6d}".format(int(CisloKrabice)))
        CisloPalety=(NacteniTxtD["CISLO_PALETY"]); CisloPaletyF = ("{:0>2d}".format(int(CisloPalety)))
        #SERIE = (NacteniTxtD["SERIE"]);
        #BALIL = (NacteniTxtD["BALIL"]);
        #MNOZSTVI = str(len(VypisL))
        #print("č. krabice: ", CisloKrabiceF)
        #print("Prefix: ", SERIE)
        #print("Roli v krabici: ", MNOZSTVI)
        #VypisL.reverse()
        AL=[];j=1;LeftKrL=[]; RightKrL=[];RadekL=[]; RadekLL=[];
        for radek in VypisL: # výpis každé krabice
            #print ("212", radek)
            AL = []
            if radek.count("|") >= 1: # vytřídění bordelu
                radek=radek.replace("_", " ").replace("\n","")
                radekL = radek.split("|")
                #print ("212", radekL)
                AL.append(str(i))
                AL.append(str(j))
                AL.append (str(CisloPaletyF))
                AL.append(str(CisloKrabiceF))
                AL.append(str(radekL[2]))
                AL.append(str(radekL[3]))
                AL.append(str(radekL[1]))
            if (len(AL)) > 1:
                    if ((i) % 2) != 0: LeftKrL.append(AL); # liché řádky
                    else: RightKrL.append(AL);
            j = j + 1 # role
        i = i + 1  # krabice

        if len (LeftKrL)>1:
            RadekL1.append(LeftKrL)
        if len(RightKrL) > 1:
            RadekL2.append(RightKrL)

    RadekD={}
    for a in range (0, int(len(RadekL1))): # kratší sloupec
        #print (a)
        try: RadekD[a]=RadekL1[a]+RadekL2[a]
        except: RadekD[a]=RadekL1[a]+[["","","","","","",""],["","","","","","",""],["","","","","","",""],["","","","","","",""]] # v případě lichého řádku
    for radek in RadekD.values():
        for i in range (0,4):
            #print ((radek[i]),(radek[i+4]))
            A1= str(radek[i][2]); B1= str(radek[i+4][2])
            A2 = str(radek[i][3]);B2 = str(radek[i+4][3]);
            A3 = str(radek[i][4]);B3 = str(radek[i+4][4]);
            A4 = str(radek[i][5]);B4 = str(radek[i+4][5]);
            A5 = str(radek[i][6]);B5 = str(radek[i+4][6]);

            PL.set_x(x1)  # tab. vlevo
            PL.cell(10, th, A1, border=1, ln=0, align="L")
            PL.cell(15, th, A2, border=1, ln=0, align="L")
            PL.cell(22, th, A3, border=1, ln=0, align="L")
            PL.cell(22, th, A4, border=1, ln=0, align="L")
            PL.cell(15, th, A5, border=1, ln=0, align="C")
            PL.cell(8, th, "", border=0, ln=0, align="C")
            PL.cell(10, th, B1, border=1, ln=0, align="L")
            PL.cell(15, th, B2, border=1, ln=0, align="L")
            PL.cell(22, th, B3, border=1, ln=0, align="L")
            PL.cell(22, th, B4, border=1, ln=0, align="L")
            PL.cell(15, th, B5, border=1, ln=1, align="C")
        PL.set_y(PL.get_y() + 0.4)  # rozpal mezi krabicema
    PL.output(cestaPDF_PL)  # uložení Paletového listu
    try:
        webbrowser.open(cestaPDF_PL)  # otevření prohlížeče # ZAPNOUT!!!
    except:   pass #ctypes.windll.user32.MessageBoxW(0, "Zavři okno s PDF", "Warning message", 0)
def Nahled_PDF(Cesta):
    webbrowser.open(Cesta, new=0, autoraise=True)  # otevření prohlížeče 0=nové okno, True= zvětšení

#Stitek_Krabice( ['C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\\\TXT\\73_1234_1_000.txt', 'C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\\\TXT\\74_1234_1_010.txt', 'C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\\\TXT\\75_1234_1_020.txt', 'C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\\\TXT\\76_1234_1_030.txt', 'C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\\\TXT\\77_1234_1_040.txt', 'C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\\\TXT\\78_1234_1_050.txt'],"C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\")
#Stitek_Paleta("C:\\Users\\malam\\Desktop\\IGT\\Nová složka\\REZANI\\IGT_Sazka\\", 2, "A33333",[])
"""
<TR></TR>     řádek v tabulce
<TD></TD>     buňka v řádku

<b>         tučně
&nbsp;    mezera
<p>   odstavec    nepovinně
<br>  řádkový zlom    ne
div     oddíl   ano
center  vycentrování    ano
h1  nadpis 1. úrovně    ano
h2  nadpis 2 úrovně     ano
h3  nadpis 3. úrovně    ano
h4  nadpis 4. úrovně    ano
h5  nadpis 5. úrovně    ano
h6  nadpis 6. úrovně    ano
blockquote  citace, odsazení    ano
address     adresa  ano
pre     předformátovaný text    ano
hr  vodorovná čára  ne
<big>  zvětšení písma
"""
