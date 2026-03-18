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
import unicodedata
import charade # detekce kódování
#import Image1
#from PIL import Image,PngImagePlugin
import os
import string
#from barcodeEAN import EanBarCode
import base64
import shelve
import webbrowser
from shutil import copyfile
import ctypes # chybové hlášky 
from fpdf import FPDF
import win32api # tisk
import win32con
import win32print # tisk

import wx
from wx.html import HtmlEasyPrinting
#import pdfkit
#import weasyprint # PDF z HTML
#import pdfkit  # PDF z HTML


CWD=os.getcwd() # getcvd vrátí adresu  "current working directory"
#global TableL1

def PrehozLog(CestaUloz): # vznik protokolu , TN= Tisk/Náhled
        try: copyfile(CWD+"\\Loga\\" +'LogoCD.png', Cesta+"\\HTML\\"+'LogoCD.png')# přehození loga do adresáře TXT
        except: print ("   Logo nenalezeno")
        try: copyfile(CWD+"\\Loga\\" +'LogoDPB.png', Cesta+"\\HTML\\"+'LogoDPB.png')# přehození loga do adresáře TXT
        except: print ("   Logo nenalezeno")        


def NacteniTXT(CestaTxt,JOB,BALIL1,OK_Print): # OK_Print:  A= spuštěno z "OK" N= spuštěno z "PRINT"
    #ST = FPDF(orientation='P', unit='mm', format=("A4"))#  štítek na jednu stránku
    #ST.add_page()  # štítek na jednu stránku
    #ST.add_font('DejaVu-Bold', '', 'Fonty\\DejaVuSansCondensed-Bold.ttf', uni=True) # font Latin1
    #ST.add_font('DejaVu', '', 'Fonty\\DejaVuSansCondensed.ttf', uni=True) # font Latin1 # po run vznikne .pkl, které  obsahuje nastavení vč. cesta
    Skladovani="Skladujte v rozmezí teplot max: +20 +/-5°C a v max relat. vlhkosti vzduchu: 60% +/-10%"               

    #print ("  ",CestaTxt.split("\\")[-1]); 
    with open(CestaTxt, "r", encoding="utf8") as f:  # načtení ks z hotových TXT            
            VypisL=f.readlines() #načtení  obsahu TXT po řádcích do listu
            if len (VypisL)>1: #eliminace prázdných (nehotových)
                #print ("........",(VypisL))
                #MNOZSTVI=str(len(VypisL)-6) # 6= počet řádků za tabulkou
                #CISLO="..................";JOB="...............................";CISLO="....";BALIL="..............................."
                if OK_Print=="PRINT": # v případě povelu k tisku z "print"
                    CISLO="0"; BALIL=BALIL1;  C_KRAB_NA_PALETE="  ";PRODUKCE=""
                else: pass
                for sekvence in VypisL:              
                    if sekvence.count( "JOB" ) ==1: JOB=sekvence.replace("JOB: ", '').replace("\n", '').replace(" ","")
                    else: pass    
                    if sekvence.count( "BALIL" ) ==1: BALIL=sekvence.replace("BALIL: ", '').replace("\n", '')
                    else: pass #BALIL=BALIL.replace("\n", '') #  načteno z paramerů  funkce - tisk rozdělané krabice 
                    if sekvence.count( "CISLO_KRABICE" ) ==1: CISLO=sekvence.replace("CISLO_KRABICE:", '').replace("\n", '').replace(" ","")                   
                    else: pass #CISLO="0"
                    #print ("71...",CISLO, sekvence.count( "CISLO_KRABICE" ) )
                    if sekvence.count( "PRODUKCE" ) ==1:  PRODUKCE=sekvence.replace("PRODUKCE: ", '').replace("\n", '').replace(" ","")
                    else: pass #PRODUKCE=""
                    if sekvence.count( "C_KRAB_NA_PALETE:" ) ==1:
                        C_KRAB_NA_PALETE =sekvence.replace("C_KRAB_NA_PALETE: ", '').replace("\n", '').replace(" ","")
                        if C_KRAB_NA_PALETE=="-": C_KRAB_NA_PALETE="  "
                        #print ("....78", C_KRAB_NA_PALETE)
                    else: pass #C_KRAB_NA_PALETE=""
            else: CISLO="Prazdna krabice"; BALIL="";PRODUKCE="";C_KRAB_NA_PALETE="" # prázdný protokol                   
            VypisL=[n for n in VypisL if n.count ("|")== 3] #  filtr pouze pro tabulku  !!!
                
    return  {"JOB":JOB, "BALIL":BALIL,"CISLO":CISLO, "PRODUKCE":PRODUKCE,"C_KRAB_NA_PALETE": C_KRAB_NA_PALETE , "VypisL":VypisL}                 
# DPB ######################################### DPB

def Ulozeni_PDF(CestaTxtL, Cesta, JOB,BALIL,NT,OK_Print):
     #print ("89", (CestaTxtL, Cesta, JOB,BALIL,NT,OK_Print))
     CestaStitekPDFL=[]; CestaProtokolPDFL=[];  m=0; n=0;  p=1;# dy=okraj papíru u štítku
     if JOB.count("CD_POP_NEXGO")==1:
         BL = FPDF(orientation='P', unit='mm', format='A4')#  BL
         BL.add_font('DejaVu-Bold', '', 'Fonty\\DejaVuSansCondensed-Bold.ttf', uni=True) # font Latin1
         BL.add_font('DejaVu', '', 'Fonty\\DejaVuSansCondensed.ttf', uni=True) # font Latin1 # po run vznikne .pkl, které  obsahuje nastavení vč. cesta         

         ST = FPDF(orientation='P', unit='mm', format=("A4"))#  štítek na jednu stránku
         ST.add_page()  # štítek na jednu stránku
         ST.add_font('DejaVu-Bold', '', 'Fonty\\DejaVuSansCondensed-Bold.ttf', uni=True) # font Latin1
         ST.add_font('DejaVu', '', 'Fonty\\DejaVuSansCondensed.ttf', uni=True) # font Latin1 # po run vznikne .pkl, které  obsahuje nastavení vč. cesta
         for  CestaTxt in CestaTxtL:
                #print (p, ".  z ", len(CestaTxtL));n=n+1
                NacteniTxtD=NacteniTXT(CestaTxt,JOB,BALIL,OK_Print)
                VypisL=(NacteniTxtD["VypisL"]); CISLO=(NacteniTxtD["CISLO"]);C_KRAB_NA_PALETE=(NacteniTxtD["C_KRAB_NA_PALETE"])
                BALIL=(NacteniTxtD["BALIL"]);
                #print (VypisL)
                MNOZSTVI=str(len(VypisL)) # 8= počet řádků za tabulkou !!!!!
           
                VypisL.reverse()# převrácení Listu !  Jednička na začátek                
                r=1
                VypisL2=[]
                for  pol in VypisL:
                        pol=pol+"|"+(str("{:0>2d}".format(int(r))))
                        r=r+1
                        VypisL2.append(pol)
                        #print (pol)
                #print ("109,,,",VypisL2)              
                length = len(VypisL2);  polovina = int(length/2) # rozdělení Listu napůl (Dvě tabulky)
                first_halfL= VypisL2[:polovina]# první polovina listu
                second_halfL= VypisL2[polovina:]# druhá polovina listu            
                BL.add_page();
                BL.set_font('DejaVu', '', 6);  BL.cell(0, 10, C_KRAB_NA_PALETE , border=0, ln = 2, align="L")                
                BL.set_font('DejaVu-Bold', '', 16)
                Nadpis1=("BALNÝ LIST");
                BL.cell(0, 40, Nadpis1, border=0,ln =2, align="C")#šířka, výška  border=0/1; align the text L/C/R;  0/1/2: to the right/to the beginning of the next line/below 
                BL.set_font('DejaVu-Bold', '', 12)

                Job_nazev=("Jízdní doklad POP NEXGO");
                Typ_dokladu=("Hm 0 735 2 4125    KSM  2252362");               
  
                BL.cell(0, 0, Job_nazev, border=0,ln = 2, align="C") #
                BL.set_font('DejaVu-Bold', '', 12)
                BL.cell(0, 10, Typ_dokladu, border=0,ln = 2, align="C") #                   
                BL.cell(0, 25, "", 0, 2)# prázdný řádek
                BL.set_font('DejaVu', '', 10)# tabulka
                 
                th = 1.2*BL.font_size;              
                BL.set_font('DejaVu-Bold', '', 7); BL.set_xy(55,75)  # tab. vlevo
                BL.cell(10, 1.5*th, "Poř. č.:",   border=1,ln = 0,align="C") #
                BL.cell(10, 1.5*th, "Serie.:",   border=1,ln = 0,align="C") #                         
                BL.cell(16, 1.5*th, "Od č.:",border=1,ln = 0,align="C")
                BL.cell(16, 1.5*th, "Do č.:",border=1,ln = 1,align="C")
                BL.set_font('DejaVu', '', 9);
                for radek in first_halfL: #  první sloupec
                        BL.set_x(55)  # zřejmě se to vynuluje
                        if radek.count ("|")>=3: # vytřídění bordelu
                            radekL=radek.split("|")
                            if JOB.count("DPB_AVJ")==1:  radekL[3]="-" # sloupec do    
                            #r=str("{:,}".format(int(r))); print (r)
                            BL.cell(10, th, str(radekL[4]), border=1,ln = 0, align="C") #
                            BL.cell(10, th, str(radekL[1]), border=1,ln = 0, align="C") # 
                            BL.cell(16, th, str(radekL[2]), border=1,ln = 0, align="C")
                            BL.cell(16, th, str(radekL[3].replace("\n","")), border=1,ln = 1, align="C" )
                BL.set_font('DejaVu-Bold', '', 7); BL.set_xy(110,75)  # tab. vlevo
                BL.cell(10, 1.5*th, "Poř. č.:",   border=1,ln = 0,align="C") #
                BL.cell(10, 1.5*th, "Serie.:",   border=1,ln = 0,align="C") #                    
                BL.cell(16, 1.5*th, "Od č.:",border=1,ln = 0,align="C")
                BL.cell(16, 1.5*th, "Do č.:",border=1,ln = 1,align="C")
                BL.set_font('DejaVu', '', 9);                      
                for radek in second_halfL:     # druhý sloupec
                        BL.set_x(110)  # zřejmě se to vynuluje
                        if radek.count ("|")>=3: # vytřídění bordelu
                            radekL=radek.split("|")
                            if JOB.count("DPB_AVJ")==1:  radekL[3]="-" # sloupec do 
                            BL.cell(10, th, str(radekL[4]), border=1,ln = 0, align="C") #
                            BL.cell(10, th, str(radekL[1]), border=1,ln = 0, align="C") # 
                            BL.cell(16, th, str(radekL[2]), border=1,ln = 0, align="C")
                            BL.cell(16, th, str(radekL[3].replace("\n","")), border=1,ln = 1, align="C" )
                #pdf.output("C:\\Users\\malam\\Desktop\\Výstupy\\REZANI\DPB_AVJ\\testings.pdf")
                BL.cell(0, 15, "", 0, 2)# prázdný řádek
                Serie=str(radekL[1])
                #Kontrola="Kontroloval a balil: "+BALIL.encode("CP1250","ignore").decode("utf8")
                #Krab_cislo="Krabice č: " +CISLO +"   Na paletě:   " +C_KRAB_NA_PALETE+".  " ;  Mnozstvi="Počet ks: "+MNOZSTVI
                Krab_cislo="Krabice č: " +CISLO+"   " ;  Mnozstvi="Počet ks: "+MNOZSTVI
                BL.set_font('DejaVu-Bold', '', 8);  BL.cell(0, th, Krab_cislo, border=0, ln = 0, align="L");  
                BL.set_x(80);  BL.cell(0, th, Mnozstvi, border=0, ln = 1, align="L");
                BL.cell(0, 15, "", 0, 2)# prázdný řádek
                Kontrola="Kontroloval a balil: "+BALIL#.encode("ASCII","ignore").decode("utf8")
                BL.set_font('DejaVu', '', 8);  BL.cell(0, 10, Kontrola , border=0, ln = 2, align="L") #         
                Skladovani="Skladujte v rozmezí teplot max: +20 +/-5°C a v max relat. vlhkosti vzduchu: 60% +/-10%"
                BL.set_font('DejaVu', '', 8);  BL.cell(0, 10, Skladovani, border=0,ln = 2, align="L") #
                #print("224", Cesta+"PDF\\"+CISLO+"_protokol.pdf")
                cestaPDF_BL=Cesta+"PDF\\"+CISLO+"_"+C_KRAB_NA_PALETE+"BL.pdf"
                CestaProtokolPDFL.append(cestaPDF_BL)
                                       
# ŠTÍTEK
                Ox=10; Oy= 10; #Okraj zLeva, sHora
                Sx=105; Sy=70 # Skip zLeva, sHora
                Pozice=[(Ox,Oy), (Ox+Sx,Oy),  (Ox,Oy+Sy),(Ox+Sx,Oy+Sy),   (Ox,Oy+2*Sy),(Ox+Sx,Oy+2*Sy),   (Ox,Oy+3*Sy),(Ox+Sx,Oy+3*Sy),(Ox,Oy+4*Sy),(Ox+Sx,Oy+4*Sy), ];
                
                dx,dy=Pozice[m]
                m=m+1;  #print (dx,dy)
                #print (dx, dy)
                
                ST.line(105, 0, 105, 297) # vertikální              
                #ST.line(0, dy, 210, dy)# horizontální

                ST.set_xy(dx, dy)

                Job_nazev=("Jízdní doklad POP NEXGO");
                Typ_dokladu=("Hm 0 735 2 4125    KSM  2252362");               
                #ST.line(0, dy-4, 150, dy-4) # horizontální
                ST.set_font('DejaVu-Bold', '', 11); th= 1.05*ST.font_size;  # pro Nadpis2
                ST.cell(0, th, Job_nazev, border=0, ln = 2, align="L") #   
                ST.set_font('DejaVu-Bold', '', 9); th= 1.5*ST.font_size;   # pro Nadpis2
                ST.cell(0, th, Typ_dokladu, border=0,ln = 2, align="L")
                ST.cell(0, 1.4, "", 0, ln = 2)# prázdný řádek

                VypisS=""                 
                          
                #Serie= radek.split("|")[1]
                #ST.set_xy(dx, dy+Sy)
 
                #print (dx,dy)
                ST.set_x(dx) #vnucená pozice po Multicell
                ST.cell(0, 1.4, "", 0,  ln = 2 )# prázdný řádek
                Krab_cislo="Serie: "+  Serie +  "   Krabice č.: "  +CISLO+"." +"       Počet ks v bal: "+MNOZSTVI
                #ST.set_xy(dx, dy+26)
                ST.set_font('DejaVu-Bold', '', 9);  ST.cell(0, th, Krab_cislo, border=0, ln = 2, align="L");
                ST.cell(0, 1.2, "", 0, 2)# prázdný řádek
                
                ST.cell(0, 1.4, "", 0, ln = 2)# prázdný řádek
                Skladovani1="Skladujte v rozmezí teplot max: +20 +/-5°C \na v max relat. vlhkosti vzduchu: 60% +/-10%"                
                ST.set_font('DejaVu', '', 6); #ST.cell(0, th, Skladovani1, border=0, ln = 2, align="L") # Skladujte...
                ST.multi_cell (82, 3, Skladovani1, 0,0,0); ST.set_x(dx) #vnucená pozice po Multicell  
                
                # číslo krab:
                ST.cell(0, 1.4, "", 0,  ln = 2 )# prázdný řádek
                ST.set_font('DejaVu', '', 7);  ST.cell(0, th, C_KRAB_NA_PALETE, border=0, ln = 2, align="L")

                #ST.cell(0, th, Mnozstvi, border=0, ln = 2, align="L");
                #ST.line(0,dy+Sy, 210, dy+Sy)# horizontální
                
                
                cestaPDF_S=Cesta+"PDF\\"+CISLO+"_"+C_KRAB_NA_PALETE+"ST.pdf"
                #print ("....254", cestaPDF_S)
                CestaStitekPDFL.append(cestaPDF_S)
     #ST.line(0, dy, 210, dy)# horizontální
     try:  BL.output(cestaPDF_BL) #uložení Balného listu
     except: ctypes.windll.user32.MessageBoxW(0, "Zavři prohlížeč s PDF protokoly", "Warning message", 1)
     
     """ST.output(cestaPDF_S)   #uložení Štítku """   # Štítek vypnutý !                    
                
     #print ("223 NT", len(NT))
     if NT.count(0)>=1: 
                        #print ("   Nahled PDF")
                        #webbrowser.open(cestaPDF_S) # otevření prohlížeče
                        webbrowser.open(cestaPDF_BL) # otevření prohlížeče                 
                        
     if NT.count(1)>=1: 
                        print ("   Tisk PDF  ")
                        try:
                            Tisk_PDF(cestaPDF_S)
                            Tisk_PDF(cestaPDF_S)   
                        except: print ("   Propojení s tiskárnou nefunguje")
      
     if len (NT)==0:  print ("!   Zaškrtni nějaký výstup  !")

     #webbrowser.open(cestaPDF_S) # otevření prohlížeče
     #webbrowser.open(cestaPDF_BL) # otevření prohlížeče

                
def Nahled_PDF (Cesta):                   
                    #webbrowser.open(Cesta+"PDF\\"+CISLO+"_stitek.pdf") # otevření prohlížeče
                    #print (Cesta)
                    webbrowser.open(Cesta, new=0, autoraise=True) # otevření prohlížeče 0=nové okno, True= zvětšení
                    
                   
def Tisk_PDF(CestaPDF):
                    #print ("tisk ", CestaPDF)
                    printer_name = win32print.GetDefaultPrinter () ##
                    hPrinter = win32print.OpenPrinter (printer_name)
                    #win32print.StartDocPrinter (hPrinter, 1, ("hhhhh", None, "RAW"))#To begin a print job # Název, Specifies the name of an output file. To print to a printer, set this to None, formát
                    #win32print.StartPagePrinter (hPrinter)#To begin each page, call
                    #StartDoc = ShellExecute(hwnd, "edit", filespec, "", CestaPDF, SW_SHOWNORMAL)
                    win32api.ShellExecute(0, "print", CestaPDF, None, ".", 0)##
                    #win32api.ShellExecute(0,'printto','test.pdf','"%s"' % temprint,'.',0)
                    #win32print.EndPagePrinter (hPrinter)
                    #win32print.EndDocPrinter(hPrinter)##
                    win32print.ClosePrinter(hPrinter) 
###############################################xBORDEL##############x
                 

#Ulozeni_PDF( ['C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\89_XD.txt', 'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\90_XD.txt', 'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\91_XD.txt', 'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\92_XD.txt', 'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\93_XD.txt', 'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\94_XD.txt', 'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\95_XD.txt', 'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\\\TXT\\96_XD.txt'] ,'C:\\Users\\malam\\Desktop\\Nová složka\\REZANI\\CD_POP_NEXGO\\',"CD_POP_NEXGO"," ", (0, 0) , "OK"  )

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
#https://beenje.github.io/blog/posts/parsing-html-tables-in-python-with-pandas/